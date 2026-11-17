# 🚦 K-Traffic : 전국 도로교통 실시간 모니터링 시스템

> 대한민국 전국 주요 고속도로의 실시간 교통 흐름, 소통 상태(원활·서행·정체), CCTV 관제 영상, 돌발 사고 현황 및 통계 분석을 제공하는 현대적 반응형 웹 대시보드입니다.

[![GitHub Pages](https://img.shields.io/badge/GitHub%20Pages-Live%20Demo-brightgreen?logo=github)](https://hwan1d.github.io/agy-test/)
[![Tech](https://img.shields.io/badge/Tech-HTML5%20%7C%20CSS3%20%7C%20Vanilla%20JS-blue)](https://developer.mozilla.org/)
[![Map](https://img.shields.io/badge/Map-Kakao%20Maps%20SDK%20v2-yellow)](https://developers.kakao.com/)
[![Charts](https://img.shields.io/badge/Chart-Chart.js%20v4-orange)](https://www.chartjs.org/)

---

## 🌟 주요 기능 (Key Features)

1. **🗺️ 인터랙티브 전국 도로망 관제 지도 (Kakao Maps)**
   - **Kakao Maps SDK v2** 기반 대한민국 고해상도 한글 지도
   - **카카오 전국 실시간 소통정보(TRAFFIC)** 레이어 기본 탑재 (원활·서행·정체 실시간 자동 색상 표출)
   - 주요 고속도로 노선(경부선, 영동선, 서해안선, 수도권제1순환선, 중부선, 호남선, 남해선 등) 실제 좌표 렌더링
   - 구간별 실시간 소통 상태 색상 시각화 및 팝업 정보 제공
   - 지도 이동 시 현재 영역의 CCTV를 한 번에 조회할 수 있는 플로팅 재검색 버튼 지원

2. **📹 거점별 실시간 CCTV 뷰어**
   - 서울요금소, 판교JC, 신갈JC, 안성JC, 서해대교, 구리IC, 대전IC 등 주요 거점 CCTV 마커 및 썸네일
   - 클릭 시 실시간 스트리밍 관제 모달 팝업

3. **⚠️ 실시간 돌발·사고 상황 피드**
   - 도로 사고, 긴급 공사, 기상특보(강풍/안개), 낙하물 신고 등 실시간 알림 피드
   - **위치 보기** 버튼 클릭 시 해당 사고/공사 지점으로 카메라 즉시 부드럽게 이동(FlyTo)

4. **📊 관제 통계 대시보드 (Chart.js)**
   - **노선별 평균 속도 비교** (가로 바 차트)
   - **24시간 시간대별 통행속도 추이** (라인 차트)
   - **전국 소통 상태 비율** (도넛 차트)

5. **⚡ 라이브 기능 및 편의성**
   - 10초 주기 실시간 데이터 자동 갱신 (ON/OFF 토글 및 초 단위 카운트다운)
   - 즉시 수동 새로고침 버튼
   - **다크 모드 / 라이트 모드** 테마 전환 지원
   - 한국 표준시(KST) 실시간 시계 탑재
   - 모바일, 태블릿, 데스크톱 완벽 반응형 레이아웃

---

## 📁 프로젝트 구조 (Project Structure)

```text
agy-test/
├── index.html          # 메인 대시보드 HTML
├── config.example.js   # 환경설정 템플릿 (GitHub 업로드용)
├── config.js           # 로컬 환경설정 (API Key 저장용, .gitignore 대상)
├── css/
│   └── style.css       # 하이테크 관제센터 테마 & 반응형 스타일
├── js/
│   ├── data.js         # 도로 노선 좌표, 소통 데이터 모델 & 시뮬레이션
│   ├── its-api.js      # 국가교통정보센터(ITS) 실시간 CCTV OpenAPI 연동
│   ├── map.js          # 카카오맵 SDK v2 지도 및 실시간 교통정보(TRAFFIC) 제어
│   ├── charts.js       # Chart.js 기반 통계 차트 (속도, 추이, 소통 비율)
│   └── app.js          # 대시보드 메인 컨트롤러 및 이벤트 바인딩
├── assets/             # 이미지 및 아이콘 리소스
└── README.md           # 프로젝트 문서
```

---

## 🔐 API 키 보안 관리 및 설정 방법

본 프로젝트는 보안을 위해 **API 키를 코드에 직접 하드코딩하지 않고 환경 설정 파일(`.gitignore` 처리) 및 로컬 스토리지로 분리**하여 관리합니다.

1. **`config.example.js` 파일을 복사하여 `config.js` 파일을 생성**합니다:
   ```bash
   cp config.example.js config.js
   ```
2. **`config.js` 파일을 열고 본인의 API 키를 입력**합니다:
   ```javascript
   window.ENV = {
     KAKAO_MAP_KEY: '카카오_JAVASCRIPT_KEY',
     ITS_API_KEY: '국가교통정보센터_ITS_API_KEY'
   };
   ```
   *(`config.js` 파일은 `.gitignore`에 등록되어 있어 GitHub 저장소에 절대 업로드되지 않습니다)*
3. 또는 웹 브라우저 접속 시 화면에 표시되는 **API 키 입력 팝업**을 통해 브라우저 로컬 저장소(`localStorage`)에 직접 등록하여 사용할 수도 있습니다.

---

## 📹 국가교통정보센터(ITS) 실시간 CCTV 연동 가이드

1. **[국가교통정보센터 Open API](https://openapi.its.go.kr/)**에 가입 후 로그인합니다.
2. **OpenAPI 신청** → **CCTV 영상 정보** API를 무료 신청하여 인증키(`apiKey`)를 발급받습니다.
3. 웹 대시보드 상단의 **`[📹 ITS CCTV 연동]`** 버튼을 클릭합니다.
4. 발급받은 인증키를 입력하고 **[현재 화면 CCTV 불러오기]** 또는 **[전국 고속도로 불러오기]**를 클릭하면 지도의 모든 CCTV 핀이 실시간 HLS 스트리밍 주소로 즉시 동기화됩니다.
5. 키는 브라우저의 `localStorage`에 안전하게 저장되어 재접속 시에도 유지됩니다.

---

## 🚀 로컬 실행 방법 (How to Run Locally)

외부 빌드 도구나 복잡한 설치 없이 브라우저에서 바로 실행할 수 있습니다.

### 방법 1. 정적 파일 직접 실행
`index.html` 파일을 크롬, 엣지 등 브라우저로 더블 클릭하여 엽니다.

### 방법 2. 간단한 로컬 웹 서버 실행 (권장)
```bash
# Python 3가 설치되어 있는 경우
cd /workspace/agy-test  # 또는 cd ~/agy-test
python3 -m http.server 8080

# 또는 npx serve가 있는 경우
npx serve .
```
브라우저에서 `http://localhost:8080` 접속

---

## 🌐 GitHub Pages 자동 배포 방법 (GitHub Actions 기반)

본 프로젝트는 GitHub Actions를 통해 **API 키 노출 없이 안전하게 자동 배포**됩니다.

1. **GitHub Pages 배포 소스 설정**:
   - GitHub 저장소([https://github.com/Hwan1d/agy-test](https://github.com/Hwan1d/agy-test))로 이동합니다.
   - **Settings** 탭 → 좌측 메뉴의 **Pages** 클릭.
   - **Build and deployment**의 **Source**를 `Deploy from a branch` 대신 **`GitHub Actions`** 로 선택합니다.
2. **코드 푸시**:
   - 터미널에서 변경사항을 원격 저장소로 푸시하면 GitHub Actions가 자동으로 실행됩니다:
     ```bash
     git push --force origin main
     ```
3. **자동 배포 완료**:
   - GitHub Actions가 Secrets에 등록된 `KAKAO_MAP_KEY`와 `ITS_API_KEY`를 배포 시점에만 안전하게 주입하여 사이트를 빌드합니다.
   - 약 1분 후 **`https://hwan1d.github.io/agy-test/`** 주소로 접속하면, 모든 방문자가 키 입력 없이 카카오 지도와 실시간 CCTV를 바로 볼 수 있습니다!

---

## 🔗 향후 공공데이터포털 실제 API 연동 가이드

추후 [국가교통정보센터(ITS)](https://www.its.go.kr) 또는 [공공데이터포털(data.go.kr)](https://www.data.go.kr)의 한국도로공사 실시간 소통정보 Open API 키를 발급받아 `js/data.js`의 데이터 소스를 교체할 수 있습니다:
- 국토교통부 실시간 소통정보 API: `http://openapi.its.go.kr/api/NimsSectionSpeed`
- 한국도로공사 고속도로 공공데이터 포털: 실시간 돌발정보, VMS 교통안내전광판 연동
