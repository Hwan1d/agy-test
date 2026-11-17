/**
 * 카카오맵 지도 관리 모듈 (Kakao Maps Module)
 * 환경변수(config.js) 또는 localStorage에서 카카오 API Key를 동적으로 읽어 SDK 로드
 * 전국 고속도로 노선, 카카오 실시간 교통정보(TRAFFIC), CCTV 및 돌발상황 마커 렌더링
 */

const TrafficMap = (() => {
  let map = null;
  let polylines = [];
  let cctvOverlays = [];
  let incidentOverlays = [];
  let activeCustomOverlay = null;
  let isTrafficOverlayEnabled = true;

  const KAKAO_KEY_STORAGE = 'k_traffic_kakao_key';

  // 카카오 지도 API 키 가져오기 (config.js의 ENV 우선, 없으면 localStorage)
  const getKakaoApiKey = () => {
    if (window.ENV && window.ENV.KAKAO_MAP_KEY && window.ENV.KAKAO_MAP_KEY.trim()) {
      return window.ENV.KAKAO_MAP_KEY.trim();
    }
    return localStorage.getItem(KAKAO_KEY_STORAGE) || '';
  };

  // 카카오 키 저장
  const saveKakaoApiKey = (key) => {
    if (key && key.trim()) {
      localStorage.setItem(KAKAO_KEY_STORAGE, key.trim());
      return true;
    } else {
      localStorage.removeItem(KAKAO_KEY_STORAGE);
      return false;
    }
  };

  // 지도 초기화 (SDK 동적 로딩 보장)
  const init = (containerId = 'trafficMap') => {
    const container = document.getElementById(containerId);
    if (!container) return;

    // 이미 kakao SDK가 로드되어 있는 경우
    if (typeof kakao !== 'undefined' && kakao.maps) {
      initMapInstance(container);
      return;
    }

    const apiKey = getKakaoApiKey();

    // API 키가 없는 경우 키 입력 UI 표시
    if (!apiKey) {
      renderKeyInputGuide(container, containerId);
      return;
    }

    // 동적으로 카카오맵 SDK 스크립트 삽입
    loadKakaoScript(apiKey, () => {
      initMapInstance(container);
    }, () => {
      renderKeyErrorGuide(container, apiKey);
    });
  };

  // 동적 스크립트 로더
  const loadKakaoScript = (apiKey, onSuccess, onError) => {
    const existingScript = document.getElementById('kakao-maps-sdk');
    if (existingScript) {
      existingScript.remove();
    }

    const script = document.createElement('script');
    script.id = 'kakao-maps-sdk';
    script.type = 'text/javascript';
    // https: 프로토콜 명시 (file:/// 또는 로컬 환경 호환)
    script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${encodeURIComponent(apiKey)}&autoload=false`;

    script.onload = () => {
      if (typeof kakao !== 'undefined' && kakao.maps) {
        onSuccess();
      } else {
        console.error('카카오 지도 SDK는 로드되었으나 kakao.maps 객체를 초기화하지 못했습니다.');
        if (onError) onError(new Error('kakao.maps 객체 초기화 실패'));
      }
    };

    script.onerror = (e) => {
      console.error('카카오 지도 SDK 스크립트 네트워크 로드 실패:', e);
      if (onError) onError(e);
    };

    document.head.appendChild(script);
  };

  // 지도 인스턴스 생성
  const initMapInstance = (container) => {
    kakao.maps.load(() => {
      // 대한민국 중심 좌표 (대전 부근)
      const options = {
        center: new kakao.maps.LatLng(36.35, 127.85),
        level: 12
      };

      map = new kakao.maps.Map(container, options);

      // 카카오 줌 컨트롤 우측 하단 배치
      const zoomControl = new kakao.maps.ZoomControl();
      map.addControl(zoomControl, kakao.maps.ControlPosition.BOTTOMRIGHT);

      // 카카오 지도 타입 컨트롤 (일반 / 스카이뷰) 우측 상단 배치
      const mapTypeControl = new kakao.maps.MapTypeControl();
      map.addControl(mapTypeControl, kakao.maps.ControlPosition.TOPRIGHT);

      // 카카오 전국 실시간 교통정보 오버레이 기본 활성화 (원활·서행·정체 자동 표출)
      if (isTrafficOverlayEnabled) {
        map.addOverlayMapTypeId(kakao.maps.MapTypeId.TRAFFIC);
      }

      // 고속도로 노선, CCTV, 돌발 상황 렌더링
      renderHighways();
      renderCctvMarkers();
      renderIncidentMarkers();

      // 지도 클릭 시 활성 팝업 닫기
      kakao.maps.event.addListener(map, 'click', () => {
        closeActiveOverlay();
      });

      // 지도 영역 변경 시(이동/확대축소) 플로팅 갱신 버튼 표시
      kakao.maps.event.addListener(map, 'dragend', () => {
        const floatBtn = document.getElementById('btnFloatBoundsCctv');
        if (floatBtn) floatBtn.style.display = 'inline-flex';
      });
      kakao.maps.event.addListener(map, 'zoom_changed', () => {
        const floatBtn = document.getElementById('btnFloatBoundsCctv');
        if (floatBtn) floatBtn.style.display = 'inline-flex';
      });

      // 브라우저 리사이즈 시 지도 크기 재계산
      window.addEventListener('resize', () => {
        if (map) map.relayout();
      });

      // 지도 준비 완료 이벤트 호출 (초기 자동 CCTV 연동)
      if (window.TrafficApp && typeof window.TrafficApp.onMapReady === 'function') {
        window.TrafficApp.onMapReady();
      }
    });
  };

  // 키 입력 안내 UI
  const renderKeyInputGuide = (container, containerId) => {
    container.innerHTML = `
      <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; height:100%; color:#f8fafc; padding:24px; text-align:center; background:#0b0f19;">
        <div style="width:52px; height:52px; border-radius:12px; background:rgba(56,189,248,0.15); display:flex; align-items:center; justify-content:center; font-size:1.8rem; margin-bottom:14px;">🔑</div>
        <h3 style="font-size:1.15rem; margin-bottom:8px;">카카오 지도 JavaScript 키가 필요합니다</h3>
        <p style="font-size:0.83rem; color:#94a3b8; max-width:440px; line-height:1.6; margin-bottom:16px;">
          소스코드에 키를 하드코딩하지 않고 안전하게 관리하기 위해<br>
          <strong>config.js</strong>를 생성하거나, 아래 입력창에 키를 입력해 주세요. (브라우저 로컬 스토리지에만 보관됩니다)
        </p>
        <div style="display:flex; gap:8px; width:100%; max-width:380px;">
          <input type="password" id="inputInitKakaoKey" class="custom-select" placeholder="카카오 JavaScript 키 입력" style="flex:1; font-family:monospace;">
          <button id="btnSaveInitKakaoKey" class="btn-watch-cctv" style="width:auto; padding:0 16px;">저장 & 시작</button>
        </div>
      </div>
    `;

    document.getElementById('btnSaveInitKakaoKey')?.addEventListener('click', () => {
      const input = document.getElementById('inputInitKakaoKey');
      if (input && input.value.trim()) {
        saveKakaoApiKey(input.value.trim());
        init(containerId);
      }
    });
  };

  // 키 오류 안내 UI
  const renderKeyErrorGuide = (container, key) => {
    const isFileProtocol = window.location.protocol === 'file:';
    const originText = isFileProtocol ? 'file:// (로컬 파일 직접 실행)' : window.location.origin;

    container.innerHTML = `
      <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; height:100%; color:#f8fafc; padding:24px; text-align:center; background:#0b0f19;">
        <div style="width:48px; height:48px; border-radius:12px; background:rgba(239,68,68,0.15); display:flex; align-items:center; justify-content:center; font-size:1.6rem; margin-bottom:12px;">⚠️</div>
        <h3 style="color:#ef4444; font-size:1.1rem; margin-bottom:8px;">카카오 지도 SDK 연결 실패</h3>
        
        ${isFileProtocol ? `
          <div style="background:rgba(245,158,11,0.12); border:1px solid rgba(245,158,11,0.3); padding:12px 16px; border-radius:8px; max-width:480px; margin-bottom:16px; font-size:0.82rem; color:#fde68a; line-height:1.6;">
            <strong>🚨 원인: 브라우저 파일 직접 실행(file://) 감지</strong><br>
            카카오 지도 API는 브라우저 보안 정책상 <code>file://</code> 방식으로 직접 열면 도메인 인증이 불가능하여 차단됩니다.<br>
            터미널에서 <code>python3 -m http.server 8080</code> 실행 후 <code>http://localhost:8080</code>으로 접속해 주세요!
          </div>
        ` : `
          <p style="font-size:0.83rem; color:#94a3b8; max-width:480px; line-height:1.6; margin-bottom:14px;">
            카카오 개발자 콘솔(<a href="https://developers.kakao.com" target="_blank" style="color:#38bdf8;">developers.kakao.com</a>)의<br>
            <strong>[앱 설정] → [플랫폼] → [Web 사이트 도메인]</strong>에<br>
            현재 접속 주소인 <strong style="color:#38bdf8; font-family:monospace;">${originText}</strong> 가 등록되어 있는지 확인해 주세요.
          </p>
        `}

        <div style="font-size:0.75rem; color:#64748b; font-family:monospace; margin-bottom:16px;">
          사용 중인 키: ${key ? '●●●●●●●● (보안 마스킹)' : '(미등록)'} | 접속 프로토콜: ${window.location.protocol}
        </div>

        <div style="display:flex; gap:8px;">
          <button onclick="localStorage.removeItem('${KAKAO_KEY_STORAGE}'); location.reload();" class="btn-icon">
            키 다시 입력하기
          </button>
          <button onclick="location.reload();" class="btn-watch-cctv" style="width:auto; padding:0 16px;">
            다시 시도
          </button>
        </div>
      </div>
    `;
  };

  // 실시간 카카오 교통정보 레이어 토글
  const toggleTrafficOverlay = (enable) => {
    if (!map) return;
    isTrafficOverlayEnabled = enable !== undefined ? enable : !isTrafficOverlayEnabled;
    if (isTrafficOverlayEnabled) {
      map.addOverlayMapTypeId(kakao.maps.MapTypeId.TRAFFIC);
    } else {
      map.removeOverlayMapTypeId(kakao.maps.MapTypeId.TRAFFIC);
    }
    return isTrafficOverlayEnabled;
  };

  // 기존 폴리라인 제거
  const clearPolylines = () => {
    polylines.forEach(p => p.setMap(null));
    polylines = [];
  };

  // 고속도로 노선 렌더링
  const renderHighways = (filterStatus = 'all') => {
    if (!map) return;
    clearPolylines();
    closeActiveOverlay();

    const highways = TrafficData.getHighways();

    highways.forEach(hw => {
      hw.sections.forEach(sec => {
        if (filterStatus !== 'all' && sec.status !== filterStatus) {
          return;
        }

        const path = sec.coords.map(c => new kakao.maps.LatLng(c[0], c[1]));
        const statusConf = TrafficData.STATUS_CONFIG[sec.status];
        const color = statusConf.color;

        // 고속도로 폴리라인 생성
        const polyline = new kakao.maps.Polyline({
          path: path,
          strokeWeight: 6,
          strokeColor: color,
          strokeOpacity: 0.9,
          strokeStyle: 'solid',
          strokeLineCap: 'round',
          strokeLineJoin: 'round'
        });

        polyline.setMap(map);
        polylines.push(polyline);

        // 마우스 호버 및 클릭 이벤트
        kakao.maps.event.addListener(polyline, 'mouseover', () => {
          polyline.setOptions({ strokeWeight: 9, strokeOpacity: 1 });
        });

        kakao.maps.event.addListener(polyline, 'mouseout', () => {
          polyline.setOptions({ strokeWeight: 6, strokeOpacity: 0.9 });
        });

        kakao.maps.event.addListener(polyline, 'click', (mouseEvent) => {
          showSectionOverlay(hw, sec, mouseEvent.latLng);
        });
      });
    });
  };

  // 구간 상세 정보 커스텀 오버레이 표시
  const showSectionOverlay = (highway, section, latLng) => {
    closeActiveOverlay();

    const statusConf = TrafficData.STATUS_CONFIG[section.status];
    const color = statusConf.color;

    const content = document.createElement('div');
    content.className = 'kakao-custom-overlay map-popup-card';
    content.innerHTML = `
      <div class="popup-header">
        <span class="popup-highway">${highway.name}</span>
        <span class="popup-badge badge-${section.status}">${statusConf.name}</span>
        <button class="overlay-close-btn" onclick="window.TrafficMap.closeActiveOverlay()">&times;</button>
      </div>
      <div class="popup-body">
        <h4 class="popup-section-title">${section.name}</h4>
        <div class="popup-metric-row">
          <span class="popup-label">현재 통행속도</span>
          <span class="popup-value" style="color: ${color}; font-weight:700;">${section.speed} km/h</span>
        </div>
        <div class="popup-metric-row">
          <span class="popup-label">구간 거리</span>
          <span class="popup-value">${section.length}</span>
        </div>
      </div>
    `;

    activeCustomOverlay = new kakao.maps.CustomOverlay({
      position: latLng,
      content: content,
      yAnchor: 1.15,
      zIndex: 100
    });

    activeCustomOverlay.setMap(map);
  };

  // 활성화된 팝업 오버레이 닫기
  const closeActiveOverlay = () => {
    if (activeCustomOverlay) {
      activeCustomOverlay.setMap(null);
      activeCustomOverlay = null;
    }
  };

  // CCTV 마커 렌더링 (커스텀 오버레이)
  const renderCctvMarkers = (visible = true) => {
    if (!map) return;
    cctvOverlays.forEach(o => o.setMap(null));
    cctvOverlays = [];

    if (!visible) return;

    const cctvs = TrafficData.getCctvPoints();

    cctvs.forEach(cctv => {
      const position = new kakao.maps.LatLng(cctv.coord[0], cctv.coord[1]);

      const pinDiv = document.createElement('div');
      pinDiv.className = 'cctv-pin';
      pinDiv.title = `${cctv.name} (${cctv.speed})`;
      pinDiv.innerHTML = `
        <svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor">
          <path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z"/>
        </svg>
      `;

      pinDiv.addEventListener('click', (e) => {
        e.stopPropagation();
        window.TrafficApp.openCctvModal(cctv.id);
      });

      const overlay = new kakao.maps.CustomOverlay({
        position: position,
        content: pinDiv,
        yAnchor: 0.5,
        xAnchor: 0.5,
        zIndex: 50
      });

      overlay.setMap(map);
      cctvOverlays.push(overlay);
    });
  };

  // 돌발 사고/공사 마커 렌더링
  const renderIncidentMarkers = (visible = true) => {
    if (!map) return;
    incidentOverlays.forEach(o => o.setMap(null));
    incidentOverlays = [];

    if (!visible) return;

    const incidents = TrafficData.getIncidents();

    incidents.forEach(inc => {
      const position = new kakao.maps.LatLng(inc.coord[0], inc.coord[1]);
      const pulseColor = inc.severity === 'danger' ? '#ef4444' : '#f59e0b';

      const incidentDiv = document.createElement('div');
      incidentDiv.className = `incident-pulse ${inc.severity}`;
      incidentDiv.title = `${inc.highway}: ${inc.typeName}`;
      incidentDiv.innerHTML = `
        <div class="pulse-ring" style="border-color: ${pulseColor}"></div>
        <span class="incident-icon-symbol">!</span>
      `;

      incidentDiv.addEventListener('click', (e) => {
        e.stopPropagation();
        showIncidentOverlay(inc, position);
      });

      const overlay = new kakao.maps.CustomOverlay({
        position: position,
        content: incidentDiv,
        yAnchor: 0.5,
        xAnchor: 0.5,
        zIndex: 60
      });

      overlay.setMap(map);
      incidentOverlays.push(overlay);
    });
  };

  // 돌발 상황 상세 오버레이
  const showIncidentOverlay = (inc, latLng) => {
    closeActiveOverlay();

    const liveBadge = inc.isLiveIts
      ? '<span style="font-size:0.65rem; background:#ef4444; color:#fff; padding:1px 5px; border-radius:3px; margin-left:4px; font-weight:700;">ITS LIVE</span>'
      : '';

    const content = document.createElement('div');
    content.className = 'kakao-custom-overlay map-incident-popup';
    content.innerHTML = `
      <div class="popup-header incident-${inc.severity}">
        <div style="display:flex; align-items:center;">
          <span class="incident-badge">${inc.typeName}</span>
          ${liveBadge}
        </div>
        <span class="incident-time">${inc.time}</span>
        <button class="overlay-close-btn" onclick="window.TrafficMap.closeActiveOverlay()">&times;</button>
      </div>
      <div class="popup-body">
        <h4>${inc.highway} ${inc.locationName ? '(' + inc.locationName + ')' : ''}</h4>
        <p class="incident-detail">${inc.detail}</p>
        <div class="incident-delay">
          <span>예상 지연:</span>
          <strong>+${inc.delayMin}분</strong>
        </div>
      </div>
    `;

    activeCustomOverlay = new kakao.maps.CustomOverlay({
      position: latLng,
      content: content,
      yAnchor: 1.15,
      zIndex: 110
    });

    activeCustomOverlay.setMap(map);
  };

  // 특정 노선으로 지도 영역 맞추기 (fitBounds)
  const focusHighway = (highwayId) => {
    if (!map) return;

    if (highwayId === 'all') {
      map.setLevel(12);
      map.panTo(new kakao.maps.LatLng(36.35, 127.85));
      return;
    }

    const highway = TrafficData.getHighwayById(highwayId);
    if (!highway) return;

    const bounds = new kakao.maps.LatLngBounds();
    highway.sections.forEach(sec => {
      sec.coords.forEach(coord => {
        bounds.extend(new kakao.maps.LatLng(coord[0], coord[1]));
      });
    });

    map.setBounds(bounds);
  };

  // 특정 좌표로 부드럽게 이동 (PanTo)
  const flyToCoord = (coord, level = 7) => {
    if (!map) return;
    const moveLatLon = new kakao.maps.LatLng(coord[0], coord[1]);
    map.setLevel(level);
    map.panTo(moveLatLon);
  };

  // 현재 지도 뷰포트의 영역 좌표를 ITS API 형식(minX, maxX, minY, maxY)으로 반환
  const getMapBoundsForIts = () => {
    if (!map) {
      return { minX: 126.7, maxX: 127.8, minY: 36.8, maxY: 37.8 };
    }
    const bounds = map.getBounds();
    const sw = bounds.getSouthWest();
    const ne = bounds.getNorthEast();
    return {
      minX: sw.getLng(),
      maxX: ne.getLng(),
      minY: sw.getLat(),
      maxY: ne.getLat()
    };
  };

  const getMap = () => map;

  // 데이터 갱신 시 화면 업데이트
  const updateTrafficDisplay = (currentFilter = 'all') => {
    renderHighways(currentFilter);
    renderCctvMarkers(true);
  };

  return {
    init,
    getMap,
    getMapBoundsForIts,
    getKakaoApiKey,
    saveKakaoApiKey,
    toggleTrafficOverlay,
    renderHighways,
    renderCctvMarkers,
    renderIncidentMarkers,
    focusHighway,
    flyToCoord,
    updateTrafficDisplay,
    closeActiveOverlay
  };
})();

window.TrafficMap = TrafficMap;
