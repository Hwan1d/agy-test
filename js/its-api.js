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
      const response = await fetch(requestUrl, {
        method: 'GET',
        signal: controller.signal
      });

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

            return {
              id: `its-${idx}-${Math.round(lat * 1000)}-${Math.round(lng * 1000)}`,
              name: name,
              highway: item.roadsectionid || '실시간 고속도로 관제',
              coord: [lat, lng],
              direction: '실시간 관제',
              speed: 'LIVE',
              status: 'normal',
              videoUrl: cctvUrl,
              hlsUrl: cctvUrl,
              cctvFormat: item.cctvformat || 'HLS',
              imgPlaceholder: 'https://images.unsplash.com/photo-1545179605-1296651e9d43?auto=format&fit=crop&w=600&q=80',
              description: `국가교통정보센터(ITS) 실시간 스트리밍 (${name})`
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

  return {
    getApiKey,
    saveApiKey,
    fetchCctvList
  };
})();

window.ItsApi = ItsApi;
