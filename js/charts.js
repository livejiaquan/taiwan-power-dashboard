import { getFuelColor } from "./presentation.js";

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

  createPeakBalanceChart(canvasId, balance) {
    const canvas = document.getElementById(canvasId);
    if (!canvas || !window.Chart || !balance) return null;
    this.destroy(canvasId);
    const chart = new Chart(canvas.getContext("2d"), {
      type: "doughnut",
      data: {
        labels: ["預估尖峰需求", "供需差額（能力減需求）", "需求超出能力"],
        datasets: [
          {
            data: balance.segments,
            backgroundColor: ["#ff855d", "#8ad6c3", "#df4e61"],
            borderWidth: 0,
            spacing: 3,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        rotation: 270,
        circumference: 180,
        cutout: "79%",
        animation: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (c) =>
                `${c.label}: ${Math.round(c.raw).toLocaleString("en-US")} MW`,
            },
          },
        },
      },
    });
    this.charts.set(canvasId, chart);
    return chart;
  }

  createGlanceMixChart(canvasId, categories) {
    const canvas = document.getElementById(canvasId);
    if (!canvas || !window.Chart || !categories.length) return null;
    this.destroy(canvasId);
    const rest = categories.slice(4);
    const displayCategories = [
      ...categories.slice(0, 4),
      ...(rest.length
        ? [
            {
              key: "other-glance",
              labelZh: "其餘正輸出",
              netGenerationMw: rest.reduce(
                (sum, c) => sum + c.netGenerationMw,
                0,
              ),
              positiveShare: rest.reduce((sum, c) => sum + c.positiveShare, 0),
            },
          ]
        : []),
    ];
    const chart = new Chart(canvas.getContext("2d"), {
      type: "doughnut",
      data: {
        labels: displayCategories.map((c) => c.labelZh),
        datasets: [
          {
            data: displayCategories.map((c) => c.netGenerationMw),
            backgroundColor: displayCategories.map((c) =>
              c.key === "other-glance" ? "#81949e" : getFuelColor(c.key),
            ),
            borderColor: "#0b1827",
            borderWidth: 3,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: "70%",
        animation: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (c) =>
                `${displayCategories[c.dataIndex].labelZh}: ${displayCategories[c.dataIndex].positiveShare.toFixed(1)}%`,
            },
          },
        },
      },
    });
    this.charts.set(canvasId, chart);
    return chart;
  }

  createFuelMixChart(canvasId, categories) {
    const canvas = document.getElementById(canvasId);
    if (!canvas || !window.Chart) return null;

    this.destroy(canvasId);

    const activeCategories = categories.filter(
      (category) => category.netGenerationMw > 0,
    );

    const chart = new Chart(canvas.getContext("2d"), {
      type: "doughnut",
      data: {
        labels: activeCategories.map((category) => category.labelZh),
        datasets: [
          {
            data: activeCategories.map((category) => category.netGenerationMw),
            backgroundColor: activeCategories.map((category) =>
              getFuelColor(category.key),
            ),
            borderColor: "#f3f1e9",
            borderWidth: 2,
            hoverOffset: 3,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: "72%",
        animation: false,
        plugins: {
          legend: {
            position: "bottom",
            labels: {
              color: "#50594f",
              boxWidth: 8,
              boxHeight: 8,
              padding: 12,
              font: {
                family: "'Noto Sans TC', sans-serif",
                size: 11,
                weight: 400,
              },
            },
          },
          tooltip: {
            callbacks: {
              label(context) {
                const category = activeCategories[context.dataIndex];
                return `${category.labelZh}: ${formatMw(category.netGenerationMw)} (${category.sharePercent.toFixed(1)}%)`;
              },
            },
          },
        },
      },
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

    const chart = new Chart(canvas.getContext("2d"), {
      type: "bar",
      data: {
        labels: chartCategories.map((category) => category.labelZh),
        datasets: [
          {
            data: chartCategories.map((category) => category.netGenerationMw),
            backgroundColor: chartCategories.map((category) =>
              getFuelColor(category.key),
            ),
            borderWidth: 0,
            borderRadius: 0,
            maxBarThickness: 18,
            borderSkipped: false,
          },
        ],
      },
      options: {
        indexAxis: "y",
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        plugins: {
          legend: {
            display: false,
          },
          tooltip: {
            callbacks: {
              label(context) {
                return formatMw(context.parsed.x);
              },
            },
          },
        },
        scales: {
          x: {
            beginAtZero: true,
            grid: {
              color: "#d8dacd",
              drawBorder: false,
            },
            ticks: {
              color: "#636961",
              font: { family: "'IBM Plex Mono', monospace", size: 9 },
              callback(value) {
                return Number(value).toLocaleString("zh-TW");
              },
            },
          },
          y: {
            grid: {
              display: false,
            },
            ticks: {
              color: "#50594f",
              font: {
                family: "'Noto Sans TC', sans-serif",
                size: 11,
                weight: 400,
              },
            },
          },
        },
      },
    });

    this.charts.set(canvasId, chart);
    return chart;
  }
}

function formatMw(value) {
  return `${Number(value || 0).toLocaleString("zh-TW", {
    maximumFractionDigits: 1,
  })} MW`;
}

export const chartManager = new ChartManager();
