import theme from '../../config/theme';

Page({
  data: {
    currentFood: {},
    targetFood: {},
    radarMetrics: [],
    currentRoleGroups: [],
    targetRoleGroups: [],
    roleGroups: [],
    activeFoodTab: 'target',
  },

  onLoad() {
    const payload = wx.getStorageSync('food_change_analysis_result') || {};
    this.setData(
      {
        currentFood: payload.currentFood || {},
        targetFood: payload.targetFood || {},
        radarMetrics: payload.radarMetrics || [],
        currentRoleGroups: payload.currentRoleGroups || [],
        targetRoleGroups: payload.targetRoleGroups || [],
        roleGroups: payload.roleGroups || payload.targetRoleGroups || [],
        activeFoodTab: payload.activeFoodTab || 'target',
      },
      () => {
        wx.nextTick(() => {
          setTimeout(() => this.drawRadar(), 50);
        });
      },
    );
  },

  switchFoodTab(event) {
    const activeFoodTab = event.currentTarget.dataset.tab;
    this.setData({
      activeFoodTab,
      roleGroups: activeFoodTab === 'current' ? this.data.currentRoleGroups : this.data.targetRoleGroups,
    });
  },

  comingSoon() {
    wx.showToast({ title: '下一阶段开放', icon: 'none' });
  },

  drawRadar() {
    const query = wx.createSelectorQuery().in(this);
    query
      .select('#nutritionRadar')
      .fields({ node: true, size: true })
      .exec((result) => {
        const item = result && result[0];
        if (!item || !item.node) return;
        const canvas = item.node;
        const ctx = canvas.getContext('2d');
        const dpr = wx.getWindowInfo().pixelRatio || 1;
        const width = item.width;
        const height = item.height;
        canvas.width = width * dpr;
        canvas.height = height * dpr;
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.scale(dpr, dpr);
        ctx.clearRect(0, 0, width, height);

        const centerX = width / 2;
        const centerY = height / 2;
        const radius = Math.min(width, height) * 0.28;
        const angles = [-Math.PI / 2, -Math.PI / 6, Math.PI / 6, Math.PI / 2, (5 * Math.PI) / 6, (7 * Math.PI) / 6];
        const point = (angle, scale) => ({
          x: centerX + Math.cos(angle) * radius * scale,
          y: centerY + Math.sin(angle) * radius * scale,
        });
        const polygon = (scale) => angles.map((angle) => point(angle, scale));
        const drawPath = (points, close = true) => {
          ctx.beginPath();
          points.forEach((p, index) => (index ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
          if (close) ctx.closePath();
        };

        ctx.lineWidth = 1;
        [1, 0.75, 0.5, 0.25].forEach((scale) => {
          drawPath(polygon(scale));
          ctx.strokeStyle = theme.colors.line;
          ctx.stroke();
        });
        angles.forEach((angle) => {
          const end = point(angle, 1);
          ctx.beginPath();
          ctx.moveTo(centerX, centerY);
          ctx.lineTo(end.x, end.y);
          ctx.strokeStyle = theme.colors.line;
          ctx.stroke();
        });

        const drawSeries = (values, stroke, fill) => {
          const points = values.map((value, index) => point(angles[index], value / 100));
          drawPath(points);
          ctx.fillStyle = fill;
          ctx.fill();
          ctx.lineWidth = 2;
          ctx.strokeStyle = stroke;
          ctx.stroke();
          points.forEach((p) => {
            ctx.beginPath();
            ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
            ctx.fillStyle = stroke;
            ctx.fill();
          });
        };

        const metrics = this.data.radarMetrics || [];
        drawSeries(
          metrics.map((metric) => metric.target),
          theme.colors.success,
          theme.colors.success + '18',
        );
        drawSeries(
          metrics.map((metric) => metric.current),
          theme.colors.primary,
          theme.colors.primary + '18',
        );

        const labelRadius = radius * 1.42;
        metrics.forEach((metric, index) => {
          const angle = angles[index];
          const x = centerX + Math.cos(angle) * labelRadius;
          const y = centerY + Math.sin(angle) * labelRadius;
          const lines = [metric.label, String(metric.current), String(metric.target)];
          const lineHeight = 14;
          const startY = y - ((lines.length - 1) * lineHeight) / 2;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          lines.forEach((line, lineIndex) => {
            ctx.font = `${lineIndex === 0 ? 11 : 12}px sans-serif`;
            ctx.fillStyle = lineIndex === 2 ? theme.colors.success : theme.colors.text;
            ctx.fillText(line, x, startY + lineIndex * lineHeight);
          });
        });
      });
  },
});
