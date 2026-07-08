const WEEK = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];

Page({
  data: {
    statusBarHeight: 20,
    activeMetric: 'water',
    activeMetricLabel: '饮水',
    week: WEEK,
    summary: {
      water: { value: 138, unit: 'ml', target: '目标 250 ml', rate: '55%', color: '#3f8cff' },
      litter: { value: 13, unit: '次', target: '日均 1.9 次', rate: '较上周', color: '#35b965' },
      feeding: { value: 21, unit: '次', target: '日均 3 次', rate: '较上周', color: '#f39a39' },
    },
    observations: [
      { icon: '♨', tone: 'orange', title: '饮水连续3天低于目标', desc: '建议鼓励猫咪多喝水，可尝试更换饮水方式' },
      { icon: '♟', tone: 'green', title: '排便频率稳定', desc: '本周排便频率在正常范围内，继续保持哦' },
      { icon: '◉', tone: 'orange', title: '进食时间较规律', desc: '进食次数和时间较稳定，表现良好' },
    ],
  },

  onLoad() {
    const { statusBarHeight = 20 } = wx.getWindowInfo();
    this.setData({ statusBarHeight });
  },

  onReady() { this.drawAllCharts(); },

  goBack() { wx.navigateBack(); },

  switchMetric(event) {
    const metric = event.currentTarget.dataset.metric;
    const labels = { water: '饮水', litter: '排便', feeding: '进食' };
    this.setData({ activeMetric: metric, activeMetricLabel: labels[metric] }, () => this.drawTrend());
  },

  drawAllCharts() {
    this.drawSparkline('#waterSpark', [120, 150, 135, 170, 128, 118, 165], '#3f8cff');
    this.drawSparkline('#litterSpark', [1, 2, 1, 3, 2, 2, 2], '#35b965');
    this.drawBars('#feedingBars', [2, 4, 2, 5, 3, 4, 2], '#f39a39');
    this.drawTrend();
  },

  getCanvas(selector, callback) {
    wx.createSelectorQuery().in(this).select(selector).fields({ node: true, size: true }).exec((res) => {
      if (!res[0] || !res[0].node) return;
      const canvas = res[0].node;
      const dpr = wx.getWindowInfo().pixelRatio;
      canvas.width = res[0].width * dpr;
      canvas.height = res[0].height * dpr;
      const ctx = canvas.getContext('2d');
      ctx.scale(dpr, dpr);
      callback(ctx, res[0].width, res[0].height);
    });
  },

  drawSparkline(selector, values, color) {
    this.getCanvas(selector, (ctx, width, height) => {
      const max = Math.max(...values); const min = Math.min(...values);
      ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.beginPath();
      values.forEach((value, index) => {
        const x = 5 + index * ((width - 10) / (values.length - 1));
        const y = height - 8 - ((value - min) / Math.max(max - min, 1)) * (height - 18);
        index ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
      });
      ctx.stroke();
    });
  },

  drawBars(selector, values, color) {
    this.getCanvas(selector, (ctx, width, height) => {
      const max = Math.max(...values); const gap = width / values.length;
      ctx.fillStyle = color;
      values.forEach((value, index) => ctx.fillRect(index * gap + 5, height - (value / max) * (height - 8), 6, (value / max) * (height - 8)));
    });
  },

  drawTrend() {
    const dataMap = { water: [120, 130, 110, 140, 150, 160, 150], litter: [1, 2, 1, 3, 2, 2, 2], feeding: [2, 4, 2, 5, 3, 3, 2] };
    const colorMap = { water: '#3f8cff', litter: '#35b965', feeding: '#f39a39' };
    const values = dataMap[this.data.activeMetric];
    this.getCanvas('#trendCanvas', (ctx, width, height) => {
      ctx.strokeStyle = '#e9eef5'; ctx.lineWidth = 1;
      for (let row = 0; row < 4; row += 1) { const y = 12 + row * ((height - 35) / 3); ctx.beginPath(); ctx.moveTo(26, y); ctx.lineTo(width - 6, y); ctx.stroke(); }
      const max = Math.max(...values); const min = Math.min(...values); const points = [];
      values.forEach((value, index) => points.push({ x: 30 + index * ((width - 44) / 6), y: height - 25 - ((value - min) / Math.max(max - min, 1)) * (height - 50) }));
      ctx.strokeStyle = colorMap[this.data.activeMetric]; ctx.lineWidth = 2; ctx.beginPath();
      points.forEach((point, index) => index ? ctx.lineTo(point.x, point.y) : ctx.moveTo(point.x, point.y)); ctx.stroke();
      ctx.fillStyle = '#fff'; points.forEach((point) => { ctx.beginPath(); ctx.arc(point.x, point.y, 3, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); });
      ctx.fillStyle = '#708095'; ctx.font = '10px sans-serif'; WEEK.forEach((day, index) => ctx.fillText(day, points[index].x - 10, height - 5));
    });
  },
});
