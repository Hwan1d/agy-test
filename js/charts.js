/**
 * 대시보드 통계 차트 모듈 (Traffic Charts Module)
 * Chart.js 기반 실시간 속도 비교, 시간대별 속도 추이, 소통 상태 도넛 차트
 */

const TrafficCharts = (() => {
  let speedBarChart = null;
  let trendLineChart = null;
  let statusDoughnutChart = null;

  // 차트 테마 설정
  const getThemeColors = (isDark = true) => {
    return {
      textColor: isDark ? '#94a3b8' : '#475569',
      gridColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)',
      tooltipBg: isDark ? '#1e293b' : '#ffffff',
      tooltipText: isDark ? '#f8fafc' : '#0f172a'
    };
  };

  // 차트 초기화
  const initCharts = (isDark = true) => {
    initSpeedBarChart(isDark);
    initTrendLineChart(isDark);
    initStatusDoughnutChart(isDark);
  };

  // 1. 주요 노선별 평균 속도 가로 바 차트
  const initSpeedBarChart = (isDark = true) => {
    const ctx = document.getElementById('speedBarChart');
    if (!ctx) return;

    const colors = getThemeColors(isDark);
    const highways = TrafficData.getHighways();

    const labels = highways.map(h => h.name.split(' (')[0]);
    const speeds = highways.map(h => {
      const total = h.sections.reduce((acc, s) => acc + s.speed, 0);
      return Math.round(total / h.sections.length);
    });

    const barColors = speeds.map(s => {
      if (s >= 80) return '#10b981';
      if (s >= 50) return '#f59e0b';
      return '#ef4444';
    });

    if (speedBarChart) speedBarChart.destroy();

    speedBarChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [{
          label: '평균 속도 (km/h)',
          data: speeds,
          backgroundColor: barColors,
          borderRadius: 6,
          barThickness: 16
        }]
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: colors.tooltipBg,
            titleColor: colors.tooltipText,
            bodyColor: colors.tooltipText,
            borderColor: colors.gridColor,
            borderWidth: 1,
            callbacks: {
              label: (item) => `평균 통행속도: ${item.raw} km/h`
            }
          }
        },
        scales: {
          x: {
            min: 0,
            max: 110,
            grid: { color: colors.gridColor },
            ticks: { color: colors.textColor, font: { size: 11 } }
          },
          y: {
            grid: { display: false },
            ticks: { color: colors.textColor, font: { size: 11 } }
          }
        }
      }
    });
  };

  // 2. 시간대별 교통 통행 속도 변화 추이 라인 차트
  const initTrendLineChart = (isDark = true) => {
    const ctx = document.getElementById('trendLineChart');
    if (!ctx) return;

    const colors = getThemeColors(isDark);
    const hours = ['06시', '08시', '10시', '12시', '14시', '16시', '18시', '20시', '22시'];
    const gyeongbuTrend = [92, 54, 75, 82, 85, 68, 48, 65, 88];
    const ringTrend = [85, 38, 62, 70, 72, 45, 32, 58, 80];

    if (trendLineChart) trendLineChart.destroy();

    trendLineChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: hours,
        datasets: [
          {
            label: '경부선',
            data: gyeongbuTrend,
            borderColor: '#38bdf8',
            backgroundColor: 'rgba(56, 189, 248, 0.12)',
            tension: 0.35,
            fill: true,
            pointRadius: 3.5,
            pointHoverRadius: 6
          },
          {
            label: '수도권제1순환',
            data: ringTrend,
            borderColor: '#f43f5e',
            backgroundColor: 'rgba(244, 63, 94, 0.12)',
            tension: 0.35,
            fill: true,
            pointRadius: 3.5,
            pointHoverRadius: 6
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'top',
            align: 'end',
            labels: {
              color: colors.textColor,
              font: { size: 11 },
              boxWidth: 12,
              usePointStyle: true
            }
          },
          tooltip: {
            backgroundColor: colors.tooltipBg,
            titleColor: colors.tooltipText,
            bodyColor: colors.tooltipText,
            callbacks: {
              label: (item) => `${item.dataset.label}: ${item.raw} km/h`
            }
          }
        },
        scales: {
          x: {
            grid: { color: colors.gridColor },
            ticks: { color: colors.textColor, font: { size: 11 } }
          },
          y: {
            min: 20,
            max: 100,
            grid: { color: colors.gridColor },
            ticks: { color: colors.textColor, font: { size: 11 } }
          }
        }
      }
    });
  };

  // 3. 전국 소통 상태 비율 도넛 차트
  const initStatusDoughnutChart = (isDark = true) => {
    const ctx = document.getElementById('statusDoughnutChart');
    if (!ctx) return;

    const colors = getThemeColors(isDark);
    const stats = TrafficData.getOverviewStats();

    if (statusDoughnutChart) statusDoughnutChart.destroy();

    statusDoughnutChart = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: ['원활', '서행', '정체'],
        datasets: [{
          data: [stats.normalCount, stats.slowCount, stats.congestedCount],
          backgroundColor: ['#10b981', '#f59e0b', '#ef4444'],
          borderWidth: 0,
          hoverOffset: 4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '72%',
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              color: colors.textColor,
              font: { size: 11 },
              boxWidth: 10,
              usePointStyle: true
            }
          },
          tooltip: {
            backgroundColor: colors.tooltipBg,
            titleColor: colors.tooltipText,
            bodyColor: colors.tooltipText,
            callbacks: {
              label: (item) => ` ${item.label}: ${item.raw}개 구간`
            }
          }
        }
      }
    });
  };

  // 데이터 갱신 시 차트 값 업데이트
  const updateCharts = () => {
    if (speedBarChart) {
      const highways = TrafficData.getHighways();
      const speeds = highways.map(h => {
        const total = h.sections.reduce((acc, s) => acc + s.speed, 0);
        return Math.round(total / h.sections.length);
      });
      speedBarChart.data.datasets[0].data = speeds;
      speedBarChart.data.datasets[0].backgroundColor = speeds.map(s => {
        if (s >= 80) return '#10b981';
        if (s >= 50) return '#f59e0b';
        return '#ef4444';
      });
      speedBarChart.update('none');
    }

    if (statusDoughnutChart) {
      const stats = TrafficData.getOverviewStats();
      statusDoughnutChart.data.datasets[0].data = [
        stats.normalCount,
        stats.slowCount,
        stats.congestedCount
      ];
      statusDoughnutChart.update('none');
    }
  };

  // 테마 전환 시 전체 리렌더
  const updateTheme = (isDark) => {
    initCharts(isDark);
  };

  return {
    initCharts,
    updateCharts,
    updateTheme
  };
})();

window.TrafficCharts = TrafficCharts;
