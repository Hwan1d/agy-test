/**
 * 전국 도로교통 데이터 모듈 (Traffic Data Module)
 * 전국 주요 고속도로 노선, 구간별 소통상태, CCTV 지점, 돌발 상황 데이터 관리
 */

const TrafficData = (() => {
  // 대한민국 주요 도시 및 분기점 중심 좌표
  const LOCATIONS = {
    SEOUL: [37.5665, 126.9780],
    PANGYO: [37.3948, 127.1112],
    SUWON: [37.2636, 127.0286],
    ANSEONG: [37.0080, 127.2798],
    CHEONAN: [36.8151, 127.1139],
    DAEJEON: [36.3504, 127.3845],
    GUMI: [36.1195, 128.3446],
    DAEGU: [35.8714, 128.6014],
    GYEONGJU: [35.8562, 129.2247],
    BUSAN: [35.1796, 129.0756],
    INCHEON: [37.4563, 126.7052],
    WONJU: [37.3422, 127.9202],
    GANGNEUNG: [37.7519, 128.8760],
    DANGJIN: [36.8937, 126.6283],
    GUNSAN: [35.9676, 126.7366],
    MOKPO: [34.8118, 126.3922],
    GWANGJU: [35.1595, 126.8526],
    SUNCHEON: [34.9507, 127.4872],
    JINJU: [35.1802, 128.1076],
    CHANGWON: [35.2281, 128.6811],
    ILSAN: [37.6584, 126.7725],
    UIJEONGBU: [37.7381, 127.0337],
    HANAM: [37.5393, 127.2148],
    SEONGNAM: [37.4201, 127.1265],
    ANYANG: [37.3943, 126.9568],
    CHUNCHEON: [37.8813, 127.7298]
  };

  // 주요 고속도로 노선 정보
  const HIGHWAYS = [
    {
      id: 'gyeongbu',
      name: '경부고속도로 (1호선)',
      code: '0010',
      totalLength: '416.1 km',
      sections: [
        { id: 'gb-1', name: '한남IC - 양재IC', coords: [[37.518, 127.021], [37.484, 127.032], [37.463, 127.042]], speed: 45, status: 'slow', length: '7.8 km' },
        { id: 'gb-2', name: '양재IC - 판교JC', coords: [[37.463, 127.042], [37.432, 127.078], [37.399, 127.100]], speed: 78, status: 'normal', length: '8.5 km' },
        { id: 'gb-3', name: '판교JC - 신갈JC', coords: [[37.399, 127.100], [37.350, 127.105], [37.288, 127.106]], speed: 88, status: 'normal', length: '12.4 km' },
        { id: 'gb-4', name: '신갈JC - 안성JC', coords: [[37.288, 127.106], [37.150, 127.180], [37.012, 127.240]], speed: 92, status: 'normal', length: '31.2 km' },
        { id: 'gb-5', name: '안성JC - 천안JC', coords: [[37.012, 127.240], [36.920, 127.180], [36.802, 127.150]], speed: 38, status: 'congested', length: '24.8 km' },
        { id: 'gb-6', name: '천안JC - 대전IC', coords: [[36.802, 127.150], [36.550, 127.280], [36.350, 127.440]], speed: 85, status: 'normal', length: '58.3 km' },
        { id: 'gb-7', name: '대전IC - 구미IC', coords: [[36.350, 127.440], [36.210, 127.850], [36.120, 128.350]], speed: 95, status: 'normal', length: '82.1 km' },
        { id: 'gb-8', name: '구미IC - 동대구JC', coords: [[36.120, 128.350], [35.980, 128.520], [35.870, 128.690]], speed: 72, status: 'normal', length: '39.4 km' },
        { id: 'gb-9', name: '동대구JC - 경주IC', coords: [[35.870, 128.690], [35.860, 129.020], [35.810, 129.200]], speed: 90, status: 'normal', length: '49.8 km' },
        { id: 'gb-10', name: '경주IC - 구서IC(부산)', coords: [[35.810, 129.200], [35.530, 129.130], [35.250, 129.090]], speed: 82, status: 'normal', length: '68.5 km' }
      ]
    },
    {
      id: 'yeongdong',
      name: '영동고속도로 (50호선)',
      code: '0500',
      totalLength: '234.4 km',
      sections: [
        { id: 'yd-1', name: '서창JC - 월곶JC', coords: [[37.420, 126.740], [37.380, 126.770]], speed: 65, status: 'slow', length: '5.2 km' },
        { id: 'yd-2', name: '월곶JC - 안산JC', coords: [[37.380, 126.770], [37.340, 126.850]], speed: 75, status: 'normal', length: '9.6 km' },
        { id: 'yd-3', name: '안산JC - 북수원IC', coords: [[37.340, 126.850], [37.310, 126.990]], speed: 82, status: 'normal', length: '14.1 km' },
        { id: 'yd-4', name: '북수원IC - 신갈JC', coords: [[37.310, 126.990], [37.288, 127.106]], speed: 32, status: 'congested', length: '12.8 km' },
        { id: 'yd-5', name: '신갈JC - 호법JC', coords: [[37.288, 127.106], [37.230, 127.320], [37.190, 127.450]], speed: 86, status: 'normal', length: '32.5 km' },
        { id: 'yd-6', name: '호법JC - 여주JC', coords: [[37.190, 127.450], [37.250, 127.600]], speed: 90, status: 'normal', length: '15.2 km' },
        { id: 'yd-7', name: '여주JC - 만종JC(원주)', coords: [[37.250, 127.600], [37.330, 127.870]], speed: 89, status: 'normal', length: '29.3 km' },
        { id: 'yd-8', name: '만종JC - 둔내IC', coords: [[37.330, 127.870], [37.490, 128.210]], speed: 94, status: 'normal', length: '36.8 km' },
        { id: 'yd-9', name: '둔내IC - 대관령IC', coords: [[37.490, 128.210], [37.680, 128.710]], speed: 74, status: 'normal', length: '48.2 km' },
        { id: 'yd-10', name: '대관령IC - 강릉JC', coords: [[37.680, 128.710], [37.750, 128.880]], speed: 88, status: 'normal', length: '18.7 km' }
      ]
    },
    {
      id: 'seohaean',
      name: '서해안고속도로 (15호선)',
      code: '0150',
      totalLength: '341.4 km',
      sections: [
        { id: 'sh-1', name: '금천IC - 일직JC', coords: [[37.460, 126.890], [37.430, 126.895]], speed: 35, status: 'congested', length: '4.8 km' },
        { id: 'sh-2', name: '일직JC - 조남JC', coords: [[37.430, 126.895], [37.370, 126.870]], speed: 68, status: 'slow', length: '7.5 km' },
        { id: 'sh-3', name: '조남JC - 서평택JC', coords: [[37.370, 126.870], [37.150, 126.840], [36.960, 126.850]], speed: 85, status: 'normal', length: '44.2 km' },
        { id: 'sh-4', name: '서평택JC - 서해대교 - 송악IC', coords: [[36.960, 126.850], [36.920, 126.830], [36.880, 126.750]], speed: 52, status: 'slow', length: '13.9 km' },
        { id: 'sh-5', name: '송악IC - 당진JC', coords: [[36.880, 126.750], [36.850, 126.680]], speed: 92, status: 'normal', length: '9.2 km' },
        { id: 'sh-6', name: '당진JC - 대천IC', coords: [[36.850, 126.680], [36.560, 126.580], [36.330, 126.610]], speed: 96, status: 'normal', length: '63.4 km' },
        { id: 'sh-7', name: '대천IC - 군산IC', coords: [[36.330, 126.610], [36.010, 126.750]], speed: 94, status: 'normal', length: '41.2 km' },
        { id: 'sh-8', name: '군산IC - 고창JC', coords: [[36.010, 126.750], [35.430, 126.700]], speed: 98, status: 'normal', length: '68.0 km' },
        { id: 'sh-9', name: '고창JC - 목포IC', coords: [[35.430, 126.700], [34.980, 126.520], [34.820, 126.430]], speed: 91, status: 'normal', length: '79.2 km' }
      ]
    },
    {
      id: 'ring-seoul',
      name: '수도권제1순환고속도로 (100호선)',
      code: '1000',
      totalLength: '128.0 km',
      sections: [
        { id: 'ring-1', name: '판교JC - 성남IC', coords: [[37.399, 127.100], [37.435, 127.135]], speed: 65, status: 'slow', length: '5.2 km' },
        { id: 'ring-2', name: '성남IC - 하남JC', coords: [[37.435, 127.135], [37.525, 127.200]], speed: 42, status: 'slow', length: '12.4 km' },
        { id: 'ring-3', name: '하남JC - 구리IC', coords: [[37.525, 127.200], [37.595, 127.145]], speed: 34, status: 'congested', length: '9.8 km' },
        { id: 'ring-4', name: '구리IC - 퇴계원IC - 의정부IC', coords: [[37.595, 127.145], [37.650, 127.120], [37.715, 127.050]], speed: 78, status: 'normal', length: '16.5 km' },
        { id: 'ring-5', name: '의정부IC - 송추IC - 일산IC', coords: [[37.715, 127.050], [37.695, 126.960], [37.640, 126.790]], speed: 85, status: 'normal', length: '27.4 km' },
        { id: 'ring-6', name: '일산IC - 김포IC', coords: [[37.640, 126.790], [37.590, 126.770]], speed: 58, status: 'slow', length: '8.1 km' },
        { id: 'ring-7', name: '김포IC - 서운JC - 중동IC', coords: [[37.590, 126.770], [37.530, 126.745], [37.495, 126.755]], speed: 28, status: 'congested', length: '11.6 km' },
        { id: 'ring-8', name: '중동IC - 조남JC', coords: [[37.495, 126.755], [37.420, 126.810], [37.370, 126.870]], speed: 72, status: 'normal', length: '17.3 km' },
        { id: 'ring-9', name: '조남JC - 산본IC - 판교JC', coords: [[37.370, 126.870], [37.360, 126.940], [37.399, 127.100]], speed: 81, status: 'normal', length: '19.7 km' }
      ]
    },
    {
      id: 'jungbu',
      name: '중부고속도로 (35호선)',
      code: '0351',
      totalLength: '117.2 km',
      sections: [
        { id: 'jb-1', name: '하남JC - 산곡JC', coords: [[37.525, 127.200], [37.480, 127.250]], speed: 55, status: 'slow', length: '6.5 km' },
        { id: 'jb-2', name: '산곡JC - 경기광주JC', coords: [[37.480, 127.250], [37.380, 127.310]], speed: 82, status: 'normal', length: '14.8 km' },
        { id: 'jb-3', name: '경기광주JC - 호법JC', coords: [[37.380, 127.310], [37.190, 127.450]], speed: 88, status: 'normal', length: '24.1 km' },
        { id: 'jb-4', name: '호법JC - 일죽IC', coords: [[37.190, 127.450], [37.060, 127.470]], speed: 90, status: 'normal', length: '16.2 km' },
        { id: 'jb-5', name: '일죽IC - 대소JC - 서청주IC', coords: [[37.060, 127.470], [36.930, 127.480], [36.650, 127.420]], speed: 85, status: 'normal', length: '43.6 km' },
        { id: 'jb-6', name: '서청주IC - 남이JC', coords: [[36.650, 127.420], [36.560, 127.430]], speed: 87, status: 'normal', length: '12.0 km' }
      ]
    },
    {
      id: 'namhae',
      name: '남해고속도로 (10호선)',
      code: '0100',
      totalLength: '272.6 km',
      sections: [
        { id: 'nh-1', name: '순천IC - 광양IC', coords: [[34.960, 127.520], [34.970, 127.580]], speed: 90, status: 'normal', length: '11.2 km' },
        { id: 'nh-2', name: '광양IC - 사천IC', coords: [[34.970, 127.580], [35.080, 128.080]], speed: 95, status: 'normal', length: '47.5 km' },
        { id: 'nh-3', name: '사천IC - 진주JC', coords: [[35.080, 128.080], [35.150, 128.140]], speed: 92, status: 'normal', length: '10.8 km' },
        { id: 'nh-4', name: '진주JC - 칠원JC', coords: [[35.150, 128.140], [35.260, 128.520]], speed: 86, status: 'normal', length: '39.4 km' },
        { id: 'nh-5', name: '칠원JC - 창원JC', coords: [[35.260, 128.520], [35.260, 128.660]], speed: 68, status: 'slow', length: '13.8 km' },
        { id: 'nh-6', name: '창원JC - 김해JC - 덕천IC(부산)', coords: [[35.260, 128.660], [35.260, 128.890], [35.210, 128.990]], speed: 58, status: 'slow', length: '32.1 km' }
      ]
    },
    {
      id: 'honam',
      name: '호남고속도로 (25호선)',
      code: '0251',
      totalLength: '194.2 km',
      sections: [
        { id: 'hn-1', name: '논산JC - 익산IC', coords: [[36.160, 127.120], [35.980, 127.070]], speed: 92, status: 'normal', length: '22.3 km' },
        { id: 'hn-2', name: '익산IC - 전주IC', coords: [[35.980, 127.070], [35.880, 127.060]], speed: 88, status: 'normal', length: '13.5 km' },
        { id: 'hn-3', name: '전주IC - 정읍IC', coords: [[35.880, 127.060], [35.610, 126.880]], speed: 96, status: 'normal', length: '38.7 km' },
        { id: 'hn-4', name: '정읍IC - 백양사IC - 광주광산IC', coords: [[35.610, 126.880], [35.410, 126.830], [35.210, 126.790]], speed: 91, status: 'normal', length: '49.1 km' },
        { id: 'hn-5', name: '광주광산IC - 순천JC', coords: [[35.210, 126.790], [35.190, 127.050], [34.980, 127.490]], speed: 85, status: 'normal', length: '70.6 km' }
      ]
    }
  ];

  // 주요 CCTV 지점 목록 (고속도로 관제 전용)
  const CCTV_POINTS = [
    {
      id: 'cctv-seoul-toll',
      name: '서울요금소 (경부선)',
      highway: '경부고속도로',
      coord: [37.368, 127.103],
      direction: '부산/서울 방향',
      speed: '78 km/h',
      status: 'normal',
      imgPlaceholder: 'https://images.unsplash.com/photo-1545179605-1296651e9d43?auto=format&fit=crop&w=600&q=80',
      videoUrl: '',
      hlsUrl: '',
      description: '경부선 서울기점 17.5km 지점. 본선 통행 원활.'
    },
    {
      id: 'cctv-pangyo-jc',
      name: '판교분기점 (경부선/제1순환)',
      highway: '경부선/제1순환',
      coord: [37.399, 127.100],
      direction: '전방향',
      speed: '54 km/h',
      status: 'slow',
      imgPlaceholder: 'https://images.unsplash.com/photo-1506521781263-d8422e82f27a?auto=format&fit=crop&w=600&q=80',
      videoUrl: '',
      hlsUrl: '',
      description: '판교JC 진출입로 진입차량 증가로 일시 서행.'
    },
    {
      id: 'cctv-singal-jc',
      name: '신갈분기점 (경부/영동)',
      highway: '경부선/영동선',
      coord: [37.288, 127.106],
      direction: '강릉/인천 방향',
      speed: '38 km/h',
      status: 'congested',
      imgPlaceholder: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=600&q=80',
      videoUrl: '',
      hlsUrl: '',
      description: '영동선 강릉방향 진입램프 연결로 정체 심화.'
    },
    {
      id: 'cctv-anseong-jc',
      name: '안성분기점 (경부/평택제천)',
      highway: '경부고속도로',
      coord: [37.012, 127.240],
      direction: '양방향',
      speed: '40 km/h',
      status: 'slow',
      imgPlaceholder: 'https://images.unsplash.com/photo-1498084393753-b411b2d26b34?auto=format&fit=crop&w=600&q=80',
      videoUrl: '',
      hlsUrl: '',
      description: '천안방향 차량 증가로 속도 감속 중.'
    },
    {
      id: 'cctv-seohae-bridge',
      name: '서해대교 (서해안선)',
      highway: '서해안고속도로',
      coord: [36.920, 126.830],
      direction: '목포방향 주탑부',
      speed: '52 km/h',
      status: 'slow',
      imgPlaceholder: 'https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?auto=format&fit=crop&w=600&q=80',
      videoUrl: '',
      hlsUrl: '',
      description: '서해대교 교량 통행 보통. 측풍 주의보 발령.'
    },
    {
      id: 'cctv-guri-ic',
      name: '구리IC (수도권제1순환)',
      highway: '수도권제1순환',
      coord: [37.595, 127.145],
      direction: '일산/판교 방향',
      speed: '34 km/h',
      status: 'congested',
      imgPlaceholder: 'https://images.unsplash.com/photo-1520690214124-2405c5217036?auto=format&fit=crop&w=600&q=80',
      videoUrl: '',
      hlsUrl: '',
      description: '강변북로 합류지점 연결로 정체 3.2km 지속.'
    },
    {
      id: 'cctv-daejeon-ic',
      name: '대전IC (경부고속도로)',
      highway: '경부고속도로',
      coord: [36.350, 127.440],
      direction: '부산/서울 방향',
      speed: '86 km/h',
      status: 'normal',
      imgPlaceholder: 'https://images.unsplash.com/photo-1517649763962-0c623266ddc0?auto=format&fit=crop&w=600&q=80',
      videoUrl: '',
      hlsUrl: '',
      description: '대전IC 부근 본선 및 요금소 전구간 원활.'
    },
    {
      id: 'cctv-yeoju-jc',
      name: '여주분기점 (영동/중부내륙)',
      highway: '영동고속도로',
      coord: [37.250, 127.600],
      direction: '원주/강릉 방향',
      speed: '91 km/h',
      status: 'normal',
      imgPlaceholder: 'https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?auto=format&fit=crop&w=600&q=80',
      videoUrl: '',
      hlsUrl: '',
      description: '주말 나들이 차량 전구간 정상 소통.'
    }
  ];

  // 실시간 돌발 상황 데이터 (초기값)
  let incidents = [
    {
      id: 'inc-1',
      type: 'accident',
      typeName: '추돌 사고',
      severity: 'danger',
      highway: '경부고속도로',
      locationName: '경부선 서울방향 천안JC 부근 1차로',
      coord: [36.810, 127.155],
      time: '10분 전',
      detail: '승용차 2중 추돌 사고 발생. 견인 조치 진행 중, 후미 3.5km 정체.',
      delayMin: 25
    },
    {
      id: 'inc-2',
      type: 'construction',
      typeName: '도로 공사',
      severity: 'warning',
      highway: '영동고속도로',
      locationName: '영동선 강릉방향 신갈JC - 용인IC 구간',
      coord: [37.260, 127.150],
      time: '25분 전',
      detail: '노면 포장 및 차선 도색 작업 진행 중 (갓길 및 3차로 통제).',
      delayMin: 15
    },
    {
      id: 'inc-3',
      type: 'congestion',
      typeName: '극심 정체',
      severity: 'danger',
      highway: '수도권제1순환',
      locationName: '제1순환 판교방향 구리IC - 강일IC',
      coord: [37.560, 127.170],
      time: '5분 전',
      detail: '출퇴근 및 물류 통행량 급증으로 시속 25km 이하 서행 지속.',
      delayMin: 30
    },
    {
      id: 'inc-4',
      type: 'weather',
      typeName: '강풍 주의',
      severity: 'info',
      highway: '서해안고속도로',
      locationName: '서해대교 교량 전구간',
      coord: [36.920, 126.830],
      time: '35분 전',
      detail: '해상 돌풍(풍속 14m/s) 감지. 통행차량 50km/h 이하 감속 운행 권고.',
      delayMin: 5
    },
    {
      id: 'inc-5',
      type: 'debris',
      typeName: '낙하물 신고',
      severity: 'warning',
      highway: '수도권제1순환',
      locationName: '일산방향 중동IC 부근 2차로',
      coord: [37.505, 126.750],
      time: '7분 전',
      detail: '타이어 잔해물 도로 낙하 신고 접수. 순찰대 긴급 출동 수거 중.',
      delayMin: 10
    }
  ];

  // 상태 색상 코드 매핑
  const STATUS_CONFIG = {
    normal: {
      color: '#10b981', // green
      name: '원활',
      badgeClass: 'badge-success',
      minSpeed: 80
    },
    slow: {
      color: '#f59e0b', // yellow / amber
      name: '서행',
      badgeClass: 'badge-warning',
      minSpeed: 40
    },
    congested: {
      color: '#ef4444', // red
      name: '정체',
      badgeClass: 'badge-danger',
      minSpeed: 0
    }
  };

  // 노선 전체 데이터 반환
  const getHighways = () => HIGHWAYS;

  // 특정 노선 찾기
  const getHighwayById = (id) => HIGHWAYS.find(h => h.id === id);

  // CCTV 목록 반환 (기본 + ITS 실시간 연동)
  let itsCctvPoints = [];

  const getCctvPoints = () => {
    return itsCctvPoints.length > 0 ? itsCctvPoints : CCTV_POINTS;
  };

  const setItsCctvPoints = (list) => {
    itsCctvPoints = Array.isArray(list) ? list : [];
  };

  const hasItsCctv = () => itsCctvPoints.length > 0;

  // 특정 CCTV 찾기
  const getCctvById = (id) => {
    const fromIts = itsCctvPoints.find(c => c.id === id);
    if (fromIts) return fromIts;
    return CCTV_POINTS.find(c => c.id === id);
  };

  // 돌발상황 목록 반환 및 갱신 (기본 프리셋 + ITS 실제 공공데이터)
  let liveIncidents = null;

  const getIncidents = () => {
    return (liveIncidents && liveIncidents.length > 0) ? liveIncidents : incidents;
  };

  const setIncidents = (newList) => {
    if (Array.isArray(newList)) {
      liveIncidents = newList;
    }
  };

  const hasLiveIncidents = () => {
    return Boolean(liveIncidents && liveIncidents.length > 0);
  };

  // 전체 요약 KPI 계산
  const getOverviewStats = () => {
    let totalSections = 0;
    let totalSpeed = 0;
    let congestedLength = 0;
    let normalCount = 0;
    let slowCount = 0;
    let congestedCount = 0;

    HIGHWAYS.forEach(hw => {
      hw.sections.forEach(sec => {
        totalSections++;
        totalSpeed += sec.speed;
        const lenKm = parseFloat(sec.length) || 10;
        if (sec.status === 'congested') {
          congestedLength += lenKm;
          congestedCount++;
        } else if (sec.status === 'slow') {
          slowCount++;
        } else {
          normalCount++;
        }
      });
    });

    const avgSpeed = Math.round(totalSpeed / totalSections);
    const normalRatio = Math.round((normalCount / totalSections) * 100);

    return {
      avgSpeed,
      congestedLength: Math.round(congestedLength),
      incidentCount: incidents.length,
      normalRatio,
      totalSections,
      normalCount,
      slowCount,
      congestedCount
    };
  };

  // 실시간 모의 갱신 (현실감 있는 데이터 변동 시뮬레이션)
  const simulateLiveUpdate = () => {
    HIGHWAYS.forEach(hw => {
      hw.sections.forEach(sec => {
        // -5 ~ +5 km/h 범위 변동
        const delta = Math.floor(Math.random() * 11) - 5;
        let newSpeed = Math.max(15, Math.min(115, sec.speed + delta));
        sec.speed = newSpeed;

        if (newSpeed >= 80) {
          sec.status = 'normal';
        } else if (newSpeed >= 40) {
          sec.status = 'slow';
        } else {
          sec.status = 'congested';
        }
      });
    });

    // CCTV 속도도 연동 업데이트
    CCTV_POINTS.forEach(c => {
      const delta = Math.floor(Math.random() * 9) - 4;
      let cur = parseInt(c.speed) || 70;
      let updated = Math.max(20, Math.min(110, cur + delta));
      c.speed = `${updated} km/h`;
      c.status = updated >= 80 ? 'normal' : updated >= 40 ? 'slow' : 'congested';
    });

    return getOverviewStats();
  };

  return {
    LOCATIONS,
    HIGHWAYS,
    CCTV_POINTS,
    STATUS_CONFIG,
    getHighways,
    getHighwayById,
    getCctvPoints,
    setItsCctvPoints,
    hasItsCctv,
    getCctvById,
    getIncidents,
    setIncidents,
    hasLiveIncidents,
    getOverviewStats,
    simulateLiveUpdate
  };
})();

// 전역 객체 등록
window.TrafficData = TrafficData;
