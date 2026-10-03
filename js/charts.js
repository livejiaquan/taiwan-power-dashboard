export class ChartManager {
  constructor() {
    this.charts = new Map();
  }

  destroy(id) {
    const chart = this.charts.get(id);
    if (chart) {
      chart.destroy();
      this.charts.delete(id);
    }
  }

  createFuelMixChart(canvasId, categories) {
    const canvas = document.getElementById(canvasId);
    if (!canvas || !window.Chart) return null;

    this.destroy(canvasId);

    const activeCategories = categories.filter((category) => category.netGenerationMw > 0);

    const chart = new Chart(canvas.getContext('2d'), {
      type: 'doughnut',
      data: {
        labels: activeCategories.map((category) => category.labelZh),
        datasets: [
          {
            data: activeCategories.map((category) => category.netGenerationMw),
            backgroundColor: activeCategories.map((category) => category.color),
            borderColor: '#ffffff',
            borderWidth: 3,
            hoverOffset: 8
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '68%',
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              color: '#1e293b',
              boxWidth: 12,
              padding: 16,
              font: {
                family: "'Noto Sans TC', sans-serif",
                size: 13,
                weight: 600
              }
            }
          },
          tooltip: {
            callbacks: {
              label(context) {
                const category = activeCategories[context.dataIndex];
                return `${category.labelZh}: ${formatMw(category.netGenerationMw)} (${category.sharePercent.toFixed(1)}%)`;
              }
            }
          }
        }
      }
    });

    this.charts.set(canvasId, chart);
    return chart;
  }

  createCategoryBarChart(canvasId, categories) {
    const canvas = document.getElementById(canvasId);
    if (!canvas || !window.Chart) return null;

    this.destroy(canvasId);

    const chartCategories = categories
      .filter((category) => category.netGenerationMw > 0)
      .slice(0, 10);

    const chart = new Chart(canvas.getContext('2d'), {
      type: 'bar',
      data: {
        labels: chartCategories.map((category) => category.labelZh),
        datasets: [
          {
            data: chartCategories.map((category) => category.netGenerationMw),
            backgroundColor: chartCategories.map((category) => category.color),
            borderColor: chartCategories.map((category) => category.color),
            borderWidth: 1,
            borderRadius: 6,
            borderSkipped: false
          }
        ]
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: false
          },
          tooltip: {
            callbacks: {
              label(context) {
                return formatMw(context.parsed.x);
              }
            }
          }
        },
        scales: {
          x: {
            beginAtZero: true,
            grid: {
              color: 'rgba(148, 163, 184, 0.25)',
              drawBorder: false
            },
            ticks: {
              color: '#64748b',
              callback(value) {
                return `${value.toLocaleString('zh-TW')} MW`;
              }
            }
          },
          y: {
            grid: {
              display: false
            },
            ticks: {
              color: '#1e293b',
              font: {
                family: "'Noto Sans TC', sans-serif",
                size: 13,
                weight: 700
              }
            }
          }
        }
      }
    });

    this.charts.set(canvasId, chart);
    return chart;
  }
}

function formatMw(value) {
  return `${Number(value || 0).toLocaleString('zh-TW', {
    maximumFractionDigits: 1
  })} MW`;
}

export const chartManager = new ChartManager();
