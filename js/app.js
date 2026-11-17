/**
 * 메인 애플리케이션 모듈 (Traffic App Main Controller)
 * 대시보드 UI 이벤트, KPI 요약 바인딩, CCTV 모달, 테마 전환, 실시간 갱신 루프 관리
 */

const TrafficApp = (() => {
  let isDarkMode = true;
  let autoRefreshTimer = null;
  let autoRefreshEnabled = true;
  let currentFilter = 'all';
  let refreshCountdown = 10;
  let countdownTimer = null;
  let currentHls = null;

  // 초기화
  const init = () => {
    // 1. 지도 초기화
    TrafficMap.init('trafficMap');

    // 2. 차트 초기화
    TrafficCharts.initCharts(isDarkMode);

    // 3. UI 컴포넌트 렌더링
    renderKpis();
    renderIncidentList();
    renderCctvList();
    renderHighwaySelect();

    // 4. 이벤트 바인딩
    bindEvents();

    // 5. 실시간 시계 시작
    startLiveClock();

    // 6. 자동 갱신 타이머 시작
    startAutoRefresh();
  };

  // 실시간 시계 (KST 기준)
  const startLiveClock = () => {
    const clockEl = document.getElementById('liveClock');
    const updateTime = () => {
      const now = new Date();
      const options = {
        timeZone: 'Asia/Seoul',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
      };
      const formatted = new Intl.DateTimeFormat('ko-KR', options).format(now);
      if (clockEl) {
        clockEl.innerText = `${formatted} KST`;
      }
    };
    updateTime();
    setInterval(updateTime, 1000);
  };

  // 요약 KPI 카드 렌더링
  const renderKpis = () => {
    const stats = TrafficData.getOverviewStats();

    const avgSpeedEl = document.getElementById('kpiAvgSpeed');
    const congestedLenEl = document.getElementById('kpiCongestedLen');
    const incidentsEl = document.getElementById('kpiIncidents');
    const normalRatioEl = document.getElementById('kpiNormalRatio');

    if (avgSpeedEl) avgSpeedEl.innerText = `${stats.avgSpeed} km/h`;
    if (congestedLenEl) congestedLenEl.innerText = `${stats.congestedLength} km`;
    if (incidentsEl) incidentsEl.innerText = `${stats.incidentCount} 건`;
    if (normalRatioEl) normalRatioEl.innerText = `${stats.normalRatio} %`;
  };

  // 노선 선택 셀렉트박스 채우기
  const renderHighwaySelect = () => {
    const select = document.getElementById('highwayFilterSelect');
    if (!select) return;

    const highways = TrafficData.getHighways();
    select.innerHTML = `<option value="all">전국 고속도로 전체 보기</option>`;
    highways.forEach(hw => {
      const opt = document.createElement('option');
      opt.value = hw.id;
      opt.textContent = hw.name;
      select.appendChild(opt);
    });

    select.addEventListener('change', (e) => {
      TrafficMap.focusHighway(e.target.value);
    });
  };

  // 실시간 돌발 상황 피드 렌더링
  const renderIncidentList = () => {
    const container = document.getElementById('incidentListContainer');
    if (!container) return;

    const incidents = TrafficData.getIncidents();
    container.innerHTML = '';

    incidents.forEach(inc => {
      const item = document.createElement('div');
      item.className = `incident-item severity-${inc.severity}`;
      item.innerHTML = `
        <div class="incident-item-header">
          <span class="incident-tag tag-${inc.severity}">${inc.typeName}</span>
          <span class="incident-item-time">${inc.time}</span>
        </div>
        <div class="incident-item-title">${inc.highway} - ${inc.locationName}</div>
        <div class="incident-item-desc">${inc.detail}</div>
        <div class="incident-item-footer">
          <span class="incident-delay-badge">+${inc.delayMin}분 지연</span>
          <button class="btn-goto-map" data-coord="${inc.coord.join(',')}">
            위치 보기
          </button>
        </div>
      `;

      item.querySelector('.btn-goto-map').addEventListener('click', () => {
        TrafficMap.flyToCoord(inc.coord, 13);
      });

      container.appendChild(item);
    });
  };

  // 주요 CCTV 퀵 리스트 렌더링
  const renderCctvList = () => {
    const container = document.getElementById('cctvListContainer');
    if (!container) return;

    const cctvs = TrafficData.getCctvPoints();
    container.innerHTML = '';

    cctvs.forEach(cctv => {
      const card = document.createElement('div');
      card.className = 'cctv-card-item';
      card.innerHTML = `
        <div class="cctv-thumb-wrap">
          <img src="${cctv.imgPlaceholder}" alt="${cctv.name}" loading="lazy" class="cctv-thumb-img">
          <span class="cctv-live-tag">● LIVE</span>
          <span class="cctv-speed-tag ${cctv.status}">${cctv.speed}</span>
        </div>
        <div class="cctv-meta">
          <div class="cctv-title">${cctv.name}</div>
          <div class="cctv-sub">${cctv.direction}</div>
        </div>
      `;

      card.addEventListener('click', () => {
        openCctvModal(cctv.id);
      });

      container.appendChild(card);
    });
  };

  // CCTV 상세 팝업 모달 (실제 고속도로 관제 뷰어 & Mixed Content 방어)
  const openCctvModal = (cctvId) => {
    const cctv = TrafficData.getCctvById(cctvId);
    if (!cctv) return;

    const modal = document.getElementById('cctvModal');
    const modalTitle = document.getElementById('modalCctvTitle');
    const modalVideo = document.getElementById('modalCctvVideo');
    const modalImage = document.getElementById('modalCctvImage');
    const modalCanvas = document.getElementById('modalCctvCanvas');
    const modalLocation = document.getElementById('modalCctvLocation');
    const modalSpeed = document.getElementById('modalCctvSpeed');
    const modalDesc = document.getElementById('modalCctvDesc');
    const videoLoader = document.getElementById('cctvVideoLoader');
    const videoError = document.getElementById('cctvVideoError');
    const errorMsg = document.getElementById('cctvErrorMsg');
    const btnNewTab = document.getElementById('btnOpenStreamInNewTab');
    const btnExternal = document.getElementById('btnExternalStream');
    const btnReload = document.getElementById('btnReloadCctvStream');
    const streamFpsBadge = document.getElementById('streamFpsBadge');

    if (modalTitle) modalTitle.innerText = `${cctv.name} [실시간 관제]`;
    if (modalLocation) modalLocation.innerText = `${cctv.highway} (${cctv.direction})`;
    if (modalSpeed) {
      modalSpeed.innerText = cctv.speed;
      modalSpeed.className = `modal-status-badge badge-${cctv.status}`;
    }
    if (modalDesc) modalDesc.innerText = cctv.description;

    // 타임스탬프 OSD 업데이트
    if (streamFpsBadge) {
      const now = new Date();
      const timeStr = now.toLocaleTimeString('ko-KR', { hour12: false });
      streamFpsBadge.innerText = `${timeStr} KST | HD LIVE`;
    }

    // 이전 스트림 정리
    if (currentHls) {
      currentHls.destroy();
      currentHls = null;
    }

    // 캔버스 가상 시뮬레이션은 사용하지 않으므로 숨김
    if (modalCanvas) modalCanvas.style.display = 'none';

    // UI 상태 초기화
    if (videoLoader) videoLoader.style.display = 'none';
    if (videoError) videoError.style.display = 'none';

    // 기본 현장 스틸컷 사진 설정
    const fallbackImageSrc = cctv.imgPlaceholder || 'https://images.unsplash.com/photo-1545179605-1296651e9d43?auto=format&fit=crop&w=600&q=80';
    if (modalImage) {
      modalImage.src = fallbackImageSrc;
    }

    let streamUrl = cctv.hlsUrl || cctv.videoUrl;
    let originalUrl = streamUrl;

    // Mixed Content 대응: 현재가 https이고 streamUrl이 http인 경우 https로 변경 시도
    if (streamUrl && streamUrl.startsWith('http://') && window.location.protocol === 'https:') {
      streamUrl = streamUrl.replace('http://', 'https://');
    }

    // 새 탭 및 재연결 버튼 바인딩
    const openOriginalStream = () => {
      if (originalUrl) {
        window.open(originalUrl, '_blank', 'noopener,noreferrer');
      } else {
        openItsModal();
      }
    };
    if (btnNewTab) btnNewTab.onclick = openOriginalStream;
    if (btnExternal) btnExternal.onclick = openOriginalStream;
    if (btnReload) btnReload.onclick = () => openCctvModal(cctvId);

    // 1. 순수 정지영상 포맷(JPG)인 경우: 즉시 실제 스틸컷 사진 표출
    if (cctv.cctvFormat === 'JPG' || (streamUrl && /\.(jpg|jpeg|png)$/i.test(streamUrl))) {
      if (modalVideo) modalVideo.style.display = 'none';
      if (modalImage) {
        modalImage.style.display = 'block';
        if (streamUrl) modalImage.src = streamUrl;
      }
      if (videoLoader) videoLoader.style.display = 'none';
      if (videoError) videoError.style.display = 'none';
      if (modal) modal.classList.add('active');
      return;
    }

    // 2. 스트림 URL이 없는 기본 프리셋 카메라인 경우:
    if (!streamUrl) {
      if (modalVideo) modalVideo.style.display = 'none';
      if (modalImage) modalImage.style.display = 'block';
      if (videoLoader) videoLoader.style.display = 'none';
      if (videoError) {
        videoError.style.display = 'flex';
        videoError.style.background = 'rgba(15, 23, 42, 0.78)';
      }
      if (errorMsg) {
        errorMsg.innerHTML = `
          <strong style="color:#38bdf8; font-size:0.9rem;">📹 기본 거점 도로 현장 화면</strong><br>
          <span style="font-size:0.75rem; color:#cbd5e1; display:inline-block; margin-top:6px; line-height:1.5;">
            현재 지점은 기본 프리셋 관제 화면입니다.<br>
            전국의 실제 고속도로 실시간 CCTV(HLS 스트림/스틸컷)를 연결하시려면<br>
            아래 버튼을 눌러 상단 ITS 실시간 연동을 시작하세요.
          </span>
        `;
      }
      if (btnNewTab) {
        btnNewTab.innerText = '🔍 ITS 전국 실시간 CCTV 불러오기';
      }
      if (modal) modal.classList.add('active');
      return;
    }

    // 3. 실제 스트림 URL이 있는 경우 (HLS/MP4):
    if (modalVideo) {
      modalVideo.style.display = 'block';
      modalVideo.muted = true;
      modalVideo.defaultMuted = true;
      modalVideo.setAttribute('playsinline', '');
      modalVideo.pause();
      modalVideo.removeAttribute('src');
      modalVideo.load();
    }
    if (modalImage) modalImage.style.display = 'none';
    if (videoLoader) videoLoader.style.display = 'flex';

    if (btnNewTab) {
      btnNewTab.innerText = '🔗 원본 실시간 스트림 새 창 열기';
    }

    // 재생 성공 시 로더 숨김
    if (modalVideo) {
      modalVideo.onplaying = () => {
        if (videoLoader) videoLoader.style.display = 'none';
        if (videoError) videoError.style.display = 'none';
      };

      modalVideo.onerror = () => {
        handleStreamError(cctv, originalUrl);
      };
    }

    // HLS 재생 시도
    if (streamUrl && typeof Hls !== 'undefined' && Hls.isSupported() && (streamUrl.includes('.m3u8') || !streamUrl.endsWith('.mp4'))) {
      currentHls = new Hls({
        enableWorker: true,
        lowLatencyMode: true,
        manifestLoadingTimeOut: 10000,
        manifestLoadingMaxRetry: 2
      });

      currentHls.loadSource(streamUrl);
      currentHls.attachMedia(modalVideo);

      currentHls.on(Hls.Events.MANIFEST_PARSED, () => {
        modalVideo.play().catch(e => {
          console.warn('Autoplay prevented, user interaction required:', e);
          if (videoLoader) videoLoader.style.display = 'none';
        });
      });

      currentHls.on(Hls.Events.ERROR, (event, data) => {
        if (data.fatal) {
          console.warn('HLS Fatal Error 발생:', data);
          handleStreamError(cctv, originalUrl);
        }
      });
    } else if (modalVideo && modalVideo.canPlayType('application/vnd.apple.mpegurl') && streamUrl && streamUrl.includes('.m3u8')) {
      // Safari 네이티브 HLS 지원
      modalVideo.src = streamUrl;
      modalVideo.play().catch(() => {});
    } else if (cctv.videoUrl) {
      // 일반 MP4 비디오
      modalVideo.src = cctv.videoUrl;
      modalVideo.play().catch(e => {
        console.warn('MP4 Autoplay prevented:', e);
        if (videoLoader) videoLoader.style.display = 'none';
      });
    } else {
      handleStreamError(cctv, originalUrl);
    }

    if (modal) {
      modal.classList.add('active');
    }
  };

  // 영상 로딩 에러 또는 Mixed Content 차단 시 실제 도로 스틸컷 & 바로가기 안내
  const handleStreamError = (cctv, originalUrl) => {
    const videoLoader = document.getElementById('cctvVideoLoader');
    const videoError = document.getElementById('cctvVideoError');
    const modalVideo = document.getElementById('modalCctvVideo');
    const modalImage = document.getElementById('modalCctvImage');
    const errorMsg = document.getElementById('cctvErrorMsg');
    const btnNewTab = document.getElementById('btnOpenStreamInNewTab');

    if (videoLoader) videoLoader.style.display = 'none';

    // 비디오 대신 현장 스틸컷 사진 표출
    if (modalVideo) modalVideo.style.display = 'none';
    if (modalImage) {
      modalImage.src = cctv.imgPlaceholder || 'https://images.unsplash.com/photo-1545179605-1296651e9d43?auto=format&fit=crop&w=600&q=80';
      modalImage.style.display = 'block';
    }

    const isHttpsMixed = originalUrl && originalUrl.startsWith('http://') && window.location.protocol === 'https:';

    if (errorMsg) {
      if (isHttpsMixed) {
        errorMsg.innerHTML = `
          <strong style="color:#fbbf24; font-size:0.88rem;">🔒 브라우저 HTTPS 보안(Mixed Content) 보호</strong><br>
          <span style="font-size:0.75rem; color:#cbd5e1; display:inline-block; margin-top:6px; line-height:1.5;">
            공공기관(ITS) 도로 영상(HTTP)은 브라우저 보안 규정상 웹페이지 내부 직접 재생이 차단되었습니다.<br>
            아래 <strong>[원본 실시간 스트림 새 창 열기]</strong>를 누르시면 고속도로 현장 실시간 영상을 바로 보실 수 있습니다.
          </span>
        `;
      } else {
        errorMsg.innerHTML = `
          <strong style="color:#38bdf8; font-size:0.88rem;">📺 도로 현장 관제 모드</strong><br>
          <span style="font-size:0.75rem; color:#cbd5e1; display:inline-block; margin-top:6px; line-height:1.5;">
            현재 지점의 실시간 도로 라이브 영상을 보시려면 아래 버튼을 눌러주세요.
          </span>
        `;
      }
    }

    if (btnNewTab) {
      btnNewTab.innerText = '🔗 원본 실시간 스트림 새 창 열기';
    }

    if (videoError) {
      videoError.style.display = 'flex';
      videoError.style.background = 'rgba(15, 23, 42, 0.82)';
    }
  };

  const closeCctvModal = () => {
    const modal = document.getElementById('cctvModal');
    const modalVideo = document.getElementById('modalCctvVideo');
    const videoLoader = document.getElementById('cctvVideoLoader');
    const videoError = document.getElementById('cctvVideoError');

    if (videoLoader) videoLoader.style.display = 'none';
    if (videoError) videoError.style.display = 'none';

    if (modalVideo) {
      modalVideo.pause();
      modalVideo.removeAttribute('src');
      modalVideo.load();
    }

    if (currentHls) {
      currentHls.destroy();
      currentHls = null;
    }

    if (modal) {
      modal.classList.remove('active');
    }
  };

  // ITS 설정 모달 열기/닫기
  const openItsModal = () => {
    const modal = document.getElementById('itsModal');
    const input = document.getElementById('inputItsApiKey');
    if (input) {
      input.value = ItsApi.getApiKey();
    }
    if (modal) {
      modal.classList.add('active');
    }
  };

  const closeItsModal = () => {
    const modal = document.getElementById('itsModal');
    if (modal) {
      modal.classList.remove('active');
    }
  };

  // ITS 실시간 CCTV 불러오기 핸들러
  const handleFetchItsCctv = async (isAllKorea = false, isSilent = false) => {
    const input = document.getElementById('inputItsApiKey');
    const selectRoad = document.getElementById('selectItsRoadType');
    const selectType = document.getElementById('selectItsCctvType');

    const apiKey = input && input.value.trim() ? input.value.trim() : ItsApi.getApiKey();
    if (!apiKey) {
      if (!isSilent) showItsStatus('⚠️ ITS API 인증키를 입력해 주세요.', 'error');
      return;
    }

    // 키 저장
    ItsApi.saveApiKey(apiKey);

    const roadType = selectRoad ? selectRoad.value : 'ex';
    const cctvType = selectType ? parseInt(selectType.value) : 1;

    let bounds = null;
    if (!isAllKorea && TrafficMap.getMapBoundsForIts) {
      bounds = TrafficMap.getMapBoundsForIts();
    }

    if (!isSilent) {
      showItsStatus('⏳ 국가교통정보센터(ITS)에서 실시간 CCTV 목록을 조회 중입니다...', 'info');
    }

    try {
      const list = await ItsApi.fetchCctvList({
        apiKey: apiKey,
        type: roadType,
        cctvType: cctvType,
        bounds: bounds
      });

      if (!list || list.length === 0) {
        if (!isSilent) {
          showItsStatus('해당 영역에 검색된 CCTV가 없습니다. 검색 범위를 넓히거나 전국 조회를 시도해 보세요.', 'warning');
        }
        return;
      }

      // 데이터 갱신
      TrafficData.setItsCctvPoints(list);
      TrafficMap.renderCctvMarkers(true);
      renderCctvList();

      // UI 뱃지 업데이트
      const cctvBadge = document.querySelector('.panel-section .panel-badge');
      if (cctvBadge) {
        cctvBadge.innerText = `ITS LIVE ${list.length}`;
        cctvBadge.style.color = '#38bdf8';
      }

      // 헤더의 ITS 버튼 상태 표시
      const btnOpenIts = document.getElementById('btnOpenItsModal');
      if (btnOpenIts) {
        btnOpenIts.classList.add('active');
      }

      if (!isSilent) {
        showItsStatus(`✅ 실시간 CCTV ${list.length}개가 지도에 연동되었습니다!`, 'success');
        setTimeout(() => {
          closeItsModal();
        }, 1500);
      }
    } catch (err) {
      if (!isSilent) {
        showItsStatus(`❌ 연동 오류: ${err.message} (발급된 키와 네트워크를 확인하세요)`, 'error');
      } else {
        console.warn('초기 ITS 자동 연동 대기 (수동 조회 가능):', err.message);
      }
    }
  };

  // 지도 로드 완료 시 자동 1회 조회
  const onMapReady = () => {
    // 사용자가 등록한 키로 자동 조회 시도 (silent)
    handleFetchItsCctv(false, true);
  };

  const showItsStatus = (msg, type) => {
    const el = document.getElementById('itsStatusMsg');
    if (!el) return;
    el.style.display = 'block';
    el.innerText = msg;
    if (type === 'error') {
      el.style.background = 'rgba(239, 68, 68, 0.15)';
      el.style.color = '#f87171';
      el.style.border = '1px solid rgba(239, 68, 68, 0.3)';
    } else if (type === 'success') {
      el.style.background = 'rgba(16, 185, 129, 0.15)';
      el.style.color = '#34d399';
      el.style.border = '1px solid rgba(16, 185, 129, 0.3)';
    } else if (type === 'warning') {
      el.style.background = 'rgba(245, 158, 11, 0.15)';
      el.style.color = '#fbbf24';
      el.style.border = '1px solid rgba(245, 158, 11, 0.3)';
    } else {
      el.style.background = 'rgba(56, 189, 248, 0.15)';
      el.style.color = '#38bdf8';
      el.style.border = '1px solid rgba(56, 189, 248, 0.3)';
    }
  };

  // 자동 갱신 로직 (카운트다운 포함)
  const startAutoRefresh = () => {
    if (countdownTimer) clearInterval(countdownTimer);
    refreshCountdown = 10;
    updateRefreshCountdownUI();

    countdownTimer = setInterval(() => {
      if (!autoRefreshEnabled) return;

      refreshCountdown--;
      if (refreshCountdown <= 0) {
        triggerRefresh();
        refreshCountdown = 10;
      }
      updateRefreshCountdownUI();
    }, 1000);
  };

  const updateRefreshCountdownUI = () => {
    const el = document.getElementById('refreshCountdown');
    if (el) {
      el.innerText = `${refreshCountdown}초`;
    }
  };

  // 데이터 갱신 실행
  const triggerRefresh = () => {
    // 1. 모의 데이터 갱신
    TrafficData.simulateLiveUpdate();

    // 2. 지도 폴리라인 및 마커 갱신
    TrafficMap.updateTrafficDisplay(currentFilter);

    // 3. 차트 갱신
    TrafficCharts.updateCharts();

    // 4. KPI 요약 카드 갱신
    renderKpis();

    // 5. CCTV 목록 갱신
    renderCctvList();

    // 갱신 시 시각적 플래시 애니메이션
    const pulseIndicator = document.getElementById('livePulseIndicator');
    if (pulseIndicator) {
      pulseIndicator.classList.add('pulse-active');
      setTimeout(() => pulseIndicator.classList.remove('pulse-active'), 600);
    }
  };

  // 이벤트 바인딩
  const bindEvents = () => {
    // 수동 새로고침 버튼
    const refreshBtn = document.getElementById('btnManualRefresh');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', () => {
        triggerRefresh();
        refreshCountdown = 10;
        updateRefreshCountdownUI();
      });
    }

    // 자동 갱신 토글
    const autoToggle = document.getElementById('autoRefreshToggle');
    if (autoToggle) {
      autoToggle.addEventListener('change', (e) => {
        autoRefreshEnabled = e.target.checked;
        const statusSpan = document.getElementById('autoRefreshStatusText');
        if (statusSpan) {
          statusSpan.innerText = autoRefreshEnabled ? '자동갱신 켜짐' : '자동갱신 일시정지';
        }
      });
    }

    // 소통 상태 필터 버튼 (전체, 원활, 서행, 정체)
    const filterButtons = document.querySelectorAll('.traffic-filter-btn');
    filterButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        filterButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentFilter = btn.dataset.status;
        TrafficMap.renderHighways(currentFilter);
      });
    });

    // 카카오 실시간 교통정보 레이어 토글 버튼
    const trafficLayerBtn = document.getElementById('btnToggleTrafficLayer');
    if (trafficLayerBtn) {
      trafficLayerBtn.addEventListener('click', () => {
        const isEnabled = TrafficMap.toggleTrafficOverlay();
        const textSpan = document.getElementById('trafficLayerText');
        const dotSpan = trafficLayerBtn.querySelector('.traffic-dot');
        if (isEnabled) {
          trafficLayerBtn.classList.add('active');
          if (textSpan) textSpan.innerText = '카카오 교통정보 ON';
          if (dotSpan) dotSpan.style.background = '#10b981';
        } else {
          trafficLayerBtn.classList.remove('active');
          if (textSpan) textSpan.innerText = '카카오 교통정보 OFF';
          if (dotSpan) dotSpan.style.background = '#ef4444';
        }
      });
    }

    // 다크 / 라이트 테마 토글
    const themeToggleBtn = document.getElementById('btnThemeToggle');
    if (themeToggleBtn) {
      themeToggleBtn.addEventListener('click', () => {
        isDarkMode = !isDarkMode;
        document.body.classList.toggle('light-theme', !isDarkMode);
        if (TrafficMap.setTileTheme) {
          TrafficMap.setTileTheme(isDarkMode ? 'dark' : 'light');
        }
        TrafficCharts.updateTheme(isDarkMode);
        themeToggleBtn.querySelector('.theme-text').innerText = isDarkMode ? '다크 모드' : '라이트 모드';
      });
    }

    // ITS CCTV 설정 모달 이벤트
    const btnOpenIts = document.getElementById('btnOpenItsModal');
    const btnCloseIts = document.getElementById('btnItsModalClose');
    const itsBackdrop = document.getElementById('itsModalBackdrop');
    const btnFetchBounds = document.getElementById('btnFetchCurrentBoundsCctv');
    const btnFetchAll = document.getElementById('btnFetchAllBoundsCctv');

    if (btnOpenIts) btnOpenIts.addEventListener('click', openItsModal);
    if (btnCloseIts) btnCloseIts.addEventListener('click', closeItsModal);
    if (itsBackdrop) itsBackdrop.addEventListener('click', closeItsModal);

    if (btnFetchBounds) {
      btnFetchBounds.addEventListener('click', () => handleFetchItsCctv(false));
    }
    if (btnFetchAll) {
      btnFetchAll.addEventListener('click', () => handleFetchItsCctv(true));
    }

    // 지도 플로팅 CCTV 재검색 버튼
    const floatBtn = document.getElementById('btnFloatBoundsCctv');
    if (floatBtn) {
      floatBtn.addEventListener('click', () => {
        floatBtn.style.display = 'none';
        handleFetchItsCctv(false);
      });
    }

    // 모달 닫기 버튼 (CCTV 영상 모달)
    const modalCloseBtn = document.getElementById('btnModalClose');
    const modalBackdrop = document.getElementById('modalBackdrop');
    if (modalCloseBtn) modalCloseBtn.addEventListener('click', closeCctvModal);
    if (modalBackdrop) modalBackdrop.addEventListener('click', closeCctvModal);

    // 키보드 ESC로 모달 닫기
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        closeCctvModal();
        closeItsModal();
      }
    });

    // 모바일 사이드패널 토글
    const mobilePanelToggle = document.getElementById('btnMobilePanelToggle');
    const sidePanels = document.querySelectorAll('.dashboard-side-col');
    if (mobilePanelToggle) {
      mobilePanelToggle.addEventListener('click', () => {
        sidePanels.forEach(panel => panel.classList.toggle('mobile-visible'));
      });
    }
  };

  return {
    init,
    onMapReady,
    openCctvModal,
    closeCctvModal,
    openItsModal,
    closeItsModal,
    handleFetchItsCctv,
    triggerRefresh
  };
})();

// DOMContentLoaded 시 실행
window.addEventListener('DOMContentLoaded', () => {
  TrafficApp.init();
  window.TrafficApp = TrafficApp;
});
