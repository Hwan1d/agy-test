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

  // CCTV 상세 팝업 모달 (HLS 스트리밍 & 비디오 재생 및 Mixed Content 방어)
  const openCctvModal = (cctvId) => {
    const cctv = TrafficData.getCctvById(cctvId);
    if (!cctv) return;

    const modal = document.getElementById('cctvModal');
    const modalTitle = document.getElementById('modalCctvTitle');
    const modalVideo = document.getElementById('modalCctvVideo');
    const modalImage = document.getElementById('modalCctvImage');
    const modalLocation = document.getElementById('modalCctvLocation');
    const modalSpeed = document.getElementById('modalCctvSpeed');
    const modalDesc = document.getElementById('modalCctvDesc');
    const videoLoader = document.getElementById('cctvVideoLoader');
    const videoError = document.getElementById('cctvVideoError');
    const errorMsg = document.getElementById('cctvErrorMsg');
    const btnNewTab = document.getElementById('btnOpenStreamInNewTab');
    const btnExternal = document.getElementById('btnExternalStream');
    const btnReload = document.getElementById('btnReloadCctvStream');

    if (modalTitle) modalTitle.innerText = `${cctv.name} [실시간 관제 영상]`;
    if (modalLocation) modalLocation.innerText = `${cctv.highway} (${cctv.direction})`;
    if (modalSpeed) {
      modalSpeed.innerText = cctv.speed;
      modalSpeed.className = `modal-status-badge badge-${cctv.status}`;
    }
    if (modalDesc) modalDesc.innerText = cctv.description;

    // 이전 스트림 및 캔버스 정리
    stopCctvCanvas();
    if (currentHls) {
      currentHls.destroy();
      currentHls = null;
    }

    // UI 상태 초기화
    if (videoLoader) videoLoader.style.display = 'flex';
    if (videoError) videoError.style.display = 'none';
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

    let streamUrl = cctv.hlsUrl || cctv.videoUrl;

    // Mixed Content 대응: 현재가 https이고 streamUrl이 http인 경우 https로 변경 시도
    let originalUrl = streamUrl;
    if (streamUrl && streamUrl.startsWith('http://') && window.location.protocol === 'https:') {
      streamUrl = streamUrl.replace('http://', 'https://');
    }

    // 새 탭 및 재연결 버튼 바인딩
    const openOriginalStream = () => {
      if (originalUrl) window.open(originalUrl, '_blank', 'noopener,noreferrer');
    };
    if (btnNewTab) btnNewTab.onclick = openOriginalStream;
    if (btnExternal) btnExternal.onclick = openOriginalStream;
    if (btnReload) btnReload.onclick = () => openCctvModal(cctvId);

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

  // 영상 로딩 에러 시 캔버스 관제 모드로 자동 전환 및 안내
  const handleStreamError = (cctv, originalUrl) => {
    const videoLoader = document.getElementById('cctvVideoLoader');
    const videoError = document.getElementById('cctvVideoError');
    const modalVideo = document.getElementById('modalCctvVideo');
    const errorMsg = document.getElementById('cctvErrorMsg');

    if (videoLoader) videoLoader.style.display = 'none';

    if (modalVideo) {
      modalVideo.style.display = 'none';
    }

    // 캔버스 실시간 고속도로 관제 애니메이션 시작
    startCctvCanvas(cctv);

    if (!originalUrl) {
      // 기본 관제 프리셋: 에러 오버레이 없이 캔버스 관제 모드만 깔끔하게 노출
      if (videoError) videoError.style.display = 'none';
      return;
    }

    const isHttpsMixed = originalUrl && originalUrl.startsWith('http://') && window.location.protocol === 'https:';

    if (errorMsg) {
      if (isHttpsMixed) {
        errorMsg.innerHTML = `
          <strong>🔒 브라우저 HTTPS 보안(Mixed Content) 차단 감지</strong><br>
          공공기관 CCTV 스트림(HTTP)이 브라우저 보안에 의해 차단되었습니다.<br>
          [캔버스 관제 모드]로 작동 중이며, 아래 버튼을 누르면 원본 영상이 새 창에서 열립니다!
        `;
      } else {
        errorMsg.innerHTML = `
          📺 <strong>실시간 관제 모드 작동 중</strong><br>
          (공공기관 원본 실시간 스트림 확인은 아래 버튼을 눌러주세요)
        `;
      }
    }

    if (videoError) videoError.style.display = 'flex';
  };

  let canvasAnimId = null;

  // 실시간 고속도로 관제 캔버스 시뮬레이터 (비디오 폴백 및 상시 관제용)
  const startCctvCanvas = (cctv) => {
    stopCctvCanvas();
    const canvas = document.getElementById('modalCctvCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    canvas.style.display = 'block';

    const cars = [
      { lane: 0, y: 50, speed: 2.2, color: '#f8fafc' },
      { lane: 1, y: 150, speed: 1.8, color: '#38bdf8' },
      { lane: 2, y: 90, speed: 2.6, color: '#ef4444' },
      { lane: 0, y: 260, speed: 2.1, color: '#fbbf24' },
      { lane: 2, y: 220, speed: 2.4, color: '#ffffff' }
    ];

    let laneOffset = 0;

    const render = () => {
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // 도로 아스팔트 배경
      ctx.fillStyle = '#1e293b';
      ctx.beginPath();
      ctx.moveTo(140, 0);
      ctx.lineTo(500, 0);
      ctx.lineTo(600, canvas.height);
      ctx.lineTo(40, canvas.height);
      ctx.closePath();
      ctx.fill();

      // 도로 외곽선
      ctx.strokeStyle = '#64748b';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(140, 0);
      ctx.lineTo(40, canvas.height);
      ctx.moveTo(500, 0);
      ctx.lineTo(600, canvas.height);
      ctx.stroke();

      // 중앙 차선 점선 애니메이션
      laneOffset = (laneOffset + 3.5) % 36;
      ctx.strokeStyle = '#f8fafc';
      ctx.lineWidth = 2;
      ctx.setLineDash([14, 18]);
      ctx.lineDashOffset = -laneOffset;

      // 1-2차로 구분선
      ctx.beginPath();
      ctx.moveTo(260, 0);
      ctx.lineTo(220, canvas.height);
      ctx.stroke();

      // 2-3차로 구분선
      ctx.beginPath();
      ctx.moveTo(380, 0);
      ctx.lineTo(420, canvas.height);
      ctx.stroke();
      ctx.setLineDash([]); // 초기화

      // 달리는 차량들
      cars.forEach(car => {
        car.y += car.speed;
        if (car.y > canvas.height + 40) car.y = -30;

        // 원근감에 따른 X 위치 및 크기 계산
        const progress = Math.max(0, Math.min(1, car.y / canvas.height));
        const laneCenterX = (car.lane === 0) 
          ? (200 - progress * 70) 
          : (car.lane === 1) 
            ? (320 + (progress - 0.5) * 20) 
            : (440 + progress * 70);

        const carW = 20 + progress * 16;
        const carH = 34 + progress * 24;

        // 차량 그림자
        ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
        ctx.fillRect(laneCenterX - carW/2 - 2, car.y - carH/2 + 3, carW + 4, carH + 4);

        // 차체
        ctx.fillStyle = car.color;
        ctx.beginPath();
        ctx.roundRect(laneCenterX - carW/2, car.y - carH/2, carW, carH, 4);
        ctx.fill();

        // 헤드라이트 빛 효과
        ctx.fillStyle = 'rgba(254, 240, 138, 0.85)';
        ctx.fillRect(laneCenterX - carW/2 + 2, car.y + carH/2 - 2, 4, 3);
        ctx.fillRect(laneCenterX + carW/2 - 6, car.y + carH/2 - 2, 4, 3);

        // 테일램프
        ctx.fillStyle = '#ef4444';
        ctx.fillRect(laneCenterX - carW/2 + 2, car.y - carH/2, 4, 2);
        ctx.fillRect(laneCenterX + carW/2 - 6, car.y - carH/2, 4, 2);
      });

      // CCTV 화면 노이즈/스캔라인 효과
      ctx.fillStyle = 'rgba(255, 255, 255, 0.02)';
      for (let i = 0; i < canvas.height; i += 4) {
        ctx.fillRect(0, i, canvas.width, 1.5);
      }

      // OSD 텍스트 정보 (CCTV 관제 모니터)
      const now = new Date();
      const timeStr = now.toLocaleTimeString('ko-KR', { hour12: false });
      const dateStr = now.toISOString().split('T')[0];

      ctx.fillStyle = '#22c55e';
      ctx.font = '700 13px monospace';
      ctx.fillText(`● REC [LIVE CCTV]`, 18, 28);

      ctx.fillStyle = '#f8fafc';
      ctx.font = '12px monospace';
      ctx.fillText(`${dateStr} ${timeStr} KST`, 18, 48);
      ctx.fillText(`CAM: ${cctv.name}`, 18, 66);

      ctx.fillStyle = '#38bdf8';
      ctx.fillText(`LOC: ${cctv.highway} (${cctv.direction})`, 18, canvas.height - 28);
      ctx.fillText(`SPD: ${cctv.speed} | GPS: ${cctv.coord[0].toFixed(3)}N, ${cctv.coord[1].toFixed(3)}E`, 18, canvas.height - 12);

      canvasAnimId = requestAnimationFrame(render);
    };

    render();
  };

  const stopCctvCanvas = () => {
    if (canvasAnimId) {
      cancelAnimationFrame(canvasAnimId);
      canvasAnimId = null;
    }
    const canvas = document.getElementById('modalCctvCanvas');
    if (canvas) canvas.style.display = 'none';
  };

  const closeCctvModal = () => {
    const modal = document.getElementById('cctvModal');
    const modalVideo = document.getElementById('modalCctvVideo');
    const videoLoader = document.getElementById('cctvVideoLoader');
    const videoError = document.getElementById('cctvVideoError');

    if (videoLoader) videoLoader.style.display = 'none';
    if (videoError) videoError.style.display = 'none';
    stopCctvCanvas();

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
