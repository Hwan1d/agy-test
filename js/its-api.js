/**
 * 국가교통정보센터(ITS) 실시간 CCTV OpenAPI 연동 모듈 (ITS CCTV API Module)
 * 엔드포인트: https://openapi.its.go.kr/cctvInfo
 * 기능: 전국 고속도로/국도 실시간 CCTV 메타데이터 및 HLS 스트리밍 URL 조회
 */

const ItsApi = (() => {
  const API_ENDPOINT = 'https://openapi.its.go.kr/cctvInfo';
  const STORAGE_KEY = 'k_traffic_its_api_key';
  
  // 환경설정(window.ENV) 또는 로컬 스토리지에서 저장된 API 키 불러오기
  const getApiKey = () => {
    if (window.ENV && window.ENV.ITS_API_KEY && window.ENV.ITS_API_KEY.trim()) {
      return window.ENV.ITS_API_KEY.trim();
    }
    return localStorage.getItem(STORAGE_KEY) || '';
  };

  // API 키 저장
  const saveApiKey = (key) => {
    if (key && key.trim()) {
      localStorage.setItem(STORAGE_KEY, key.trim());
      return true;
    } else {
      localStorage.removeItem(STORAGE_KEY);
      return false;
    }
  };

  /**
   * ITS 실시간 CCTV 정보 조회
   * @param {Object} options 
   *   - apiKey: ITS 인증키 (미입력 시 저장된 키 사용)
   *   - bounds: { minX, maxX, minY, maxY } (경도 X, 위도 Y)
   *   - type: 'all' (전체), 'ex' (고속도로), 'its' (국도)
   *   - cctvType: 1 (실시간 스트리밍 HLS/m3u8), 2 (동영상 파일), 3 (정지영상)
   */
  const fetchCctvList = async (options = {}) => {
    const apiKey = options.apiKey || getApiKey();
    if (!apiKey) {
      throw new Error('ITS API 키가 설정되지 않았습니다. API 키를 등록해 주세요.');
    }

    // 기본 대한민국 전역 좌표 영역 (경도: X, 위도: Y)
    // 대한민국 본토 범위: 경도 126.5 ~ 129.5, 위도 34.8 ~ 38.3
    const bounds = options.bounds || {
      minX: 126.7,
      maxX: 127.8,
      minY: 36.8,
      maxY: 37.8
    };

    const type = options.type || 'ex'; // 고속도로 기본
    const cctvType = options.cctvType || 1; // 1: 실시간 HLS 스트리밍

    // URL 구성
    const params = new URLSearchParams({
      apiKey: apiKey,
      type: type,
      cctvType: cctvType.toString(),
      minX: bounds.minX.toFixed(5),
      maxX: bounds.maxX.toFixed(5),
      minY: bounds.minY.toFixed(5),
      maxY: bounds.maxY.toFixed(5),
      getType: 'json'
    });

    const requestUrl = `${API_ENDPOINT}?${params.toString()}`;

    // 타임아웃 컨트롤러 (12초)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 12000);

    try {
      let response;
      try {
        // 1차: 브라우저 직접 요청 시도
        response = await fetch(requestUrl, {
          method: 'GET',
          signal: controller.signal
        });
      } catch (directErr) {
        console.warn('ITS 직접 연결 실패(CORS 등), 백업 프록시로 연결합니다:', directErr);
        // 2차: CORS 우회 프록시를 통해 안정적 재요청
        const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(requestUrl)}`;
        response = await fetch(proxyUrl, {
          method: 'GET',
          signal: controller.signal
        });
      }

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`ITS API 요청 실패 (HTTP 상태 코드: ${response.status})`);
      }

      const data = await response.json();

      // 응답 데이터 포맷 정규화
      if (data && data.response && data.response.data) {
        const rawList = Array.isArray(data.response.data) 
          ? data.response.data 
          : [data.response.data];

        return rawList
          .filter(item => item && item.coordx && item.coordy && item.cctvurl)
          .map((item, idx) => {
            const lat = parseFloat(item.coordy);
            const lng = parseFloat(item.coordx);
            const name = item.cctvname || `CCTV #${idx + 1}`;
            const cctvUrl = item.cctvurl;

            const isImageFormat = (cctvType === 3) || (item.cctvformat === 'JPG') || /\.(jpg|jpeg|png)$/i.test(cctvUrl);

            return {
              id: `its-${idx}-${Math.round(lat * 1000)}-${Math.round(lng * 1000)}`,
              name: name,
              highway: item.roadsectionid || '실시간 고속도로 관제',
              coord: [lat, lng],
              direction: '실시간 관제',
              speed: 'LIVE',
              status: 'normal',
              videoUrl: isImageFormat ? '' : cctvUrl,
              hlsUrl: isImageFormat ? '' : cctvUrl,
              cctvFormat: isImageFormat ? 'JPG' : (item.cctvformat || 'HLS'),
              imgPlaceholder: isImageFormat ? cctvUrl : 'https://images.unsplash.com/photo-1545179605-1296651e9d43?auto=format&fit=crop&w=600&q=80',
              description: `국가교통정보센터(ITS) 실시간 ${isImageFormat ? 'CCTV 캡처 사진' : '스트리밍'} (${name})`
            };
          });
      } else {
        return [];
      }
    } catch (err) {
      clearTimeout(timeoutId);
      console.error('ITS CCTV Fetch Error:', err);
      if (err.name === 'AbortError') {
        throw new Error('ITS API 요청 시간이 초과되었습니다 (12초). 네트워크 연결을 확인하세요.');
      } else if (err.message && err.message.includes('Failed to fetch')) {
        throw new Error('브라우저 네트워크/CORS 제한으로 인해 ITS 서버에 직접 접근하지 못했습니다. 브라우저 확장 프로그램(CORS Unblock) 또는 프록시를 확인하세요.');
      }
      throw err;
    }
  };

  /**
   * ITS 실시간 돌발상황(사고, 공사, 통제, 기상) 조회
   * 엔드포인트: https://openapi.its.go.kr/eventInfo
   * @param {Object} options 
   *   - apiKey: ITS 인증키 (미입력 시 시스템 키 사용)
   *   - bounds: { minX, maxX, minY, maxY } (경도 X, 위도 Y)
   *   - type: 'all' (전체 도로), 'ex' (고속도로), 'its' (국도)
   *   - eventType: 'all' (전체), 'acc' (사고), 'work' (공사)
   */
  const fetchIncidentList = async (options = {}) => {
    const apiKey = options.apiKey || getApiKey();
    if (!apiKey) {
      console.warn('ITS API 키 미설정: 기본 돌발 데이터 유지');
      return [];
    }

    // 기본 대한민국 전역 범위 (경도 126.3 ~ 129.8, 위도 34.5 ~ 38.6)
    const bounds = options.bounds || {
      minX: 126.3,
      maxX: 129.8,
      minY: 34.5,
      maxY: 38.6
    };

    const type = options.type || 'all';
    const eventType = options.eventType || 'all';

    const params = new URLSearchParams({
      apiKey: apiKey,
      type: type,
      eventType: eventType,
      minX: bounds.minX.toFixed(5),
      maxX: bounds.maxX.toFixed(5),
      minY: bounds.minY.toFixed(5),
      maxY: bounds.maxY.toFixed(5),
      getType: 'json'
    });

    const requestUrl = `https://openapi.its.go.kr/eventInfo?${params.toString()}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 12000);

    try {
      let response;
      try {
        // 1차: 브라우저 직접 요청
        response = await fetch(requestUrl, {
          method: 'GET',
          signal: controller.signal
        });
      } catch (directErr) {
        console.warn('ITS 돌발정보 직접 연결 대기(CORS 등), 백업 프록시로 재요청합니다:', directErr);
        // 2차: CORS 우회 프록시
        const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(requestUrl)}`;
        response = await fetch(proxyUrl, {
          method: 'GET',
          signal: controller.signal
        });
      }

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`ITS 돌발정보 HTTP ${response.status}`);
      }

      const data = await response.json();

      if (data && data.response && data.response.data) {
        const rawList = Array.isArray(data.response.data)
          ? data.response.data
          : [data.response.data];

        return rawList
          .filter(item => {
            if (!item) return false;
            const x = item.coordX || item.coordx;
            const y = item.coordY || item.coordy;
            return (x && y) || item.eventCoordinates;
          })
          .map((item, idx) => {
            let lat = parseFloat(item.coordY || item.coordy);
            let lng = parseFloat(item.coordX || item.coordx);

            if ((isNaN(lat) || isNaN(lng)) && item.eventCoordinates) {
              const coords = item.eventCoordinates.toString().trim().split(/\s+/);
              if (coords.length >= 2) {
                lng = parseFloat(coords[0]);
                lat = parseFloat(coords[1]);
              }
            }

            const rawType = (item.type || item.eventType || '').toString().trim();
            const message = (item.message || item.eventDetail || item.eventdetail || '').toString().trim();
            const roadName = (item.roadName || item.roadname || '전국 도로').toString().trim();
            const direction = (item.roadDrection || item.roadDirection || '').toString().trim();
            const laneBlocked = (item.laneBlocked || item.laneblocked || '').toString().trim();

            let severity = 'warning';
            let typeName = rawType || '도로 돌발';
            let normType = 'accident';

            if (rawType.includes('사고') || message.includes('사고') || item.eventType === '01') {
              severity = 'danger';
              typeName = '실제 사고';
              normType = 'accident';
            } else if (rawType.includes('공사') || message.includes('공사') || item.eventType === '02') {
              severity = 'warning';
              typeName = '도로 공사';
              normType = 'construction';
            } else if (rawType.includes('기상') || message.includes('강풍') || message.includes('안개') || message.includes('결빙')) {
              severity = 'info';
              typeName = '기상 특보';
              normType = 'weather';
            } else if (laneBlocked.includes('전차로') || message.includes('통제')) {
              severity = 'danger';
              typeName = '도로 통제';
              normType = 'congestion';
            }

            let timeStr = '실시간 감지';
            if (item.startTime) {
              const st = item.startTime.toString().padStart(6, '0');
              timeStr = `${st.substring(0, 2)}:${st.substring(2, 4)} 접수`;
            }

            return {
              id: `its-inc-${idx}-${Math.round(lat * 1000)}-${Math.round(lng * 1000)}`,
              type: normType,
              typeName: typeName,
              severity: severity,
              highway: roadName,
              locationName: [direction, laneBlocked].filter(Boolean).join(' / ') || '실시간 현장',
              coord: [lat, lng],
              time: timeStr,
              detail: message || `${roadName} ${direction} ${typeName} 발생 (${laneBlocked})`,
              delayMin: severity === 'danger' ? 25 : (severity === 'warning' ? 15 : 5),
              isLiveIts: true
            };
          });
      }

      return [];
    } catch (err) {
      clearTimeout(timeoutId);
      console.warn('ITS 실시간 돌발상황 조회 에러:', err.message);
      return [];
    }
  };

  // API 키 등록 여부 확인 (보안: 실제 키 문자열을 노출하지 않고 등록 여부만 불리언으로 반환)
  const hasApiKey = () => {
    return Boolean(getApiKey());
  };

  return {
    getApiKey,
    hasApiKey,
    saveApiKey,
    fetchCctvList,
    fetchIncidentList
  };
})();

window.ItsApi = ItsApi;
