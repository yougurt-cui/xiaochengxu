import config from '../../config';
import request from '../../api/request';

const FOODS = {
  current: [
    { id: 'royal-k36', brand: '皇家', name: 'K36', emoji: '🐱' },
    { id: 'now', brand: 'NOW FRESH', name: '成猫粮', emoji: '🥣' },
    { id: 'orijen', brand: '渴望', name: '原味猫粮', emoji: '🐟' },
  ],
  target: [
    { id: 'guardian', brand: '渴望', name: '八重守护', emoji: '🐟' },
    { id: 'pacifica', brand: '爱肯拿', name: '海洋盛宴', emoji: '🌊' },
    { id: 'lamb', brand: '巅峰', name: '羊肉配方', emoji: '🥩' },
  ],
};

const SYMPTOMS = ['软便敏感', '偶尔黑下巴', '下巴出油', '挑食', '泪痕', '无明显异常'];

const INGREDIENT_META = {
  animal_protein: { tone: 'coral', icon: '🥩', desc: '决定蛋白质质量和适口性' },
  plant_protein: { tone: 'green', icon: '🫛', desc: '补充植物蛋白，也参与碳水结构' },
  fat: { tone: 'yellow', icon: '💧', desc: '影响能量密度、皮肤和毛发状态' },
  carbohydrate: { tone: 'orange', icon: '🌾', desc: '用于颗粒成型和能量补充' },
  fiber: { tone: 'green', icon: '🍃', desc: '帮助便便成形和肠道过渡' },
  botanical: { tone: 'purple', icon: '🫐', desc: '低占比，不主导宏观判断' },
};

function mapIngredientGroups(analysis) {
  return ((analysis && analysis.groups) || []).map((group) => {
    const meta = INGREDIENT_META[group.category] || { tone: 'orange', icon: '◉', desc: '标准配料分类' };
    const ingredients = group.ingredients || [];
    return {
      id: group.category,
      title: group.title,
      ...meta,
      tags: ingredients.slice(0, 3),
    };
  });
}

const RADAR_DIMENSIONS = [
  { key: 'protein_quality', label: '蛋白质量', position: 'metric-top' },
  { key: 'protein_pressure', label: '蛋白压力', position: 'metric-right-top' },
  { key: 'fat_burden', label: '脂肪负担', position: 'metric-right-bottom' },
  { key: 'carb_burden', label: '碳水负担', position: 'metric-bottom' },
  { key: 'fiber_buffer', label: '纤维缓冲', position: 'metric-left-bottom' },
  { key: 'microbiome_support', label: '菌群支持', position: 'metric-left-top' },
];

const ROLE_DEFINITIONS = [
  { key: 'protein', title: '蛋白来源', icon: '🫧', tone: 'blue' },
  { key: 'starch', title: '碳水和淀粉来源', icon: '🌾', tone: 'yellow' },
  { key: 'fat', title: '脂肪来源', icon: '🟠', tone: 'orange' },
  { key: 'fiber', title: '肠道支持和纤维缓冲', icon: '🌿', tone: 'green' },
  { key: 'protection', title: '抗氧化与皮肤屏障支持', icon: '🧪', tone: 'blue' },
];

function profileValue(profile, label) {
  const point = (profile || []).find((item) => item.dimension === label);
  const value = Number(point && point.score);
  return Number.isFinite(value) ? Math.round(value * 10) / 10 : 0;
}

function mapRadarMetrics(currentProfile, targetProfile) {
  return RADAR_DIMENSIONS.map((item) => ({
    ...item,
    current: profileValue(currentProfile, item.label),
    target: profileValue(targetProfile, item.label),
  }));
}

function mapMaterialRoles(evidence, fallbackGroups = []) {
  const buckets = { protein: [], starch: [], fat: [], fiber: [], protection: [] };
  const add = (key, name) => {
    const value = String(name || '').trim();
    if (value && !buckets[key].includes(value)) buckets[key].push(value);
  };
  const items = (evidence && evidence.ingredient_items) || [];
  items.forEach((item) => {
    const role = String(item.primary_nutrition_role || '');
    const family = String(item.ingredient_family || '');
    const name = item.raw_name || item.standard_name;
    if (item.is_protein || role.includes('蛋白')) add('protein', name);
    if (role.includes('碳水') || family.includes('淀粉') || family.includes('谷物') || family.includes('根茎')) add('starch', name);
    if (role.includes('脂肪') || family.includes('油脂')) add('fat', name);
    if (role.includes('纤维') || role.includes('益生元') || family.includes('纤维')) add('fiber', name);
    if (role.includes('抗氧化') || role.includes('微量') || role.includes('皮肤')) add('protection', name);
  });
  const mapped = ROLE_DEFINITIONS.map((definition) => ({
    ...definition,
    tags: buckets[definition.key].slice(0, 8),
  })).filter((item) => item.tags.length);
  if (mapped.length) return mapped;
  return (fallbackGroups || []).map((item) => ({
    key: item.id,
    title: item.title,
    icon: item.icon,
    tone: item.tone,
    tags: item.tags || [],
  }));
}

Page({
  data: {
    statusBarHeight: 20,
    currentFood: FOODS.current[0],
    targetFood: FOODS.target[0],
    symptomText: '软便敏感 / 偶尔黑下巴',
    selectedSymptoms: ['软便敏感', '偶尔黑下巴'],
    symptomOptions: SYMPTOMS.map((label) => ({ label, selected: ['软便敏感', '偶尔黑下巴'].includes(label) })),
    showFoodSheet: false,
    foodOptions: [],
    foodTitle: '',
    foodType: 'current',
    loadingFoods: false,
    showSymptomSheet: false,
    testing: false,
    tested: false,
    recognized: false,
    inputMessage: '',
    userMessage: '',
    assistantMessage: '',
    sending: false,
    activeFoodTab: 'current',
    activeFoodTitle: '',
    activeFoodMatched: false,
    currentFoodMatched: false,
    targetFoodMatched: false,
    ingredientGroups: [],
    currentIngredientGroups: [],
    targetIngredientGroups: [],
    activeTooltip: '',
    compareLoading: false,
    radarMetrics: mapRadarMetrics([], []),
    currentRoleGroups: [],
    targetRoleGroups: [],
    roleGroups: [],
    showExitModal: false,
    savedMode: false,
    savedDraft: {},
  },

  onLoad() {
    const { statusBarHeight = 20 } = wx.getWindowInfo();
    const savedDraft = wx.getStorageSync('food_change_draft') || {};
    this.setData({
      statusBarHeight,
      savedDraft,
      savedMode: !!savedDraft.savedAt,
    });
  },

  onShow() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ value: 'assistant' });
    }
  },

  goBack() {
    if (this.data.tested) {
      this.setData({ tested: false });
      return;
    }
    if (this.data.userMessage || this.data.recognized) {
      this.setData({ showExitModal: true });
      wx.hideTabBar({ animation: true });
      return;
    }
    if (getCurrentPages().length > 1) {
      wx.navigateBack();
      return;
    }
    wx.switchTab({ url: '/pages/home/index' });
  },

  directLeave() {
    const savedDraft = {
      currentFood: this.data.currentFood,
      targetFood: this.data.targetFood,
      symptomText: this.data.symptomText,
      selectedSymptoms: this.data.selectedSymptoms,
      userMessage: this.data.userMessage,
      assistantMessage: this.data.assistantMessage,
      currentIngredientGroups: this.data.currentIngredientGroups,
      targetIngredientGroups: this.data.targetIngredientGroups,
      currentFoodMatched: this.data.currentFoodMatched,
      targetFoodMatched: this.data.targetFoodMatched,
      savedAt: Date.now(),
    };
    wx.setStorageSync('food_change_draft', savedDraft);
    wx.showTabBar({ animation: true });
    this.setData({
      showExitModal: false,
      savedMode: true,
      savedDraft,
      recognized: false,
      tested: false,
      testing: false,
      inputMessage: '',
      userMessage: '',
      assistantMessage: '',
      currentIngredientGroups: [],
      targetIngredientGroups: [],
      ingredientGroups: [],
    });
    wx.pageScrollTo({ scrollTop: 0, duration: 0 });
  },

  continueConversation(event) {
    if (this.data.showExitModal) {
      this.setData({ showExitModal: false });
      wx.showTabBar({ animation: true });
      return;
    }
    if (!event || event.currentTarget.dataset.action !== 'resume') return;
    const draft = this.data.savedDraft;
    this.setData({
      savedMode: false,
      currentFood: draft.currentFood || FOODS.current[0],
      targetFood: draft.targetFood || FOODS.target[0],
      symptomText: draft.symptomText || '暂无明显状态',
      selectedSymptoms: draft.selectedSymptoms || [],
      symptomOptions: SYMPTOMS.map((label) => ({ label, selected: (draft.selectedSymptoms || []).includes(label) })),
      userMessage: draft.userMessage || '',
      assistantMessage: draft.assistantMessage || '',
      currentIngredientGroups: draft.currentIngredientGroups || [],
      targetIngredientGroups: draft.targetIngredientGroups || [],
      currentFoodMatched: !!draft.currentFoodMatched,
      targetFoodMatched: !!draft.targetFoodMatched,
      activeFoodTab: 'current',
      ingredientGroups: draft.currentIngredientGroups || [],
      recognized: true,
    });
    wx.pageScrollTo({ scrollTop: 0, duration: 0 });
  },

  deleteSavedConversation() {
    wx.removeStorageSync('food_change_draft');
    wx.removeStorageSync('food_change_session_id');
    this.setData({
      savedMode: false,
      savedDraft: {},
      currentFood: FOODS.current[0],
      targetFood: FOODS.target[0],
      symptomText: '暂无明显状态',
      selectedSymptoms: [],
      symptomOptions: SYMPTOMS.map((label) => ({ label, selected: false })),
      inputMessage: '',
      userMessage: '',
      assistantMessage: '',
      recognized: false,
      tested: false,
      testing: false,
      sending: false,
      currentIngredientGroups: [],
      targetIngredientGroups: [],
      ingredientGroups: [],
      currentFoodMatched: false,
      targetFoodMatched: false,
    });
    wx.pageScrollTo({ scrollTop: 0, duration: 0 });
  },

  usePrompt(event) {
    const message = event.currentTarget.dataset.message || '';
    this.setData({ inputMessage: message }, () => this.sendMessage());
  },

  cyclePrompts() {
    wx.showToast({ title: '已为你换一组表达示例', icon: 'none' });
  },

  focusComposer() {
    this.setData({ tested: false });
    wx.pageScrollTo({ scrollTop: 0, duration: 300 });
  },

  async openFoodSheet(event) {
    wx.hideTabBar({ animation: true });
    const foodType = event.currentTarget.dataset.type;
    const selectedFood = this.data[`${foodType}Food`];
    this.setData({
      showFoodSheet: true,
      foodType,
      foodTitle: foodType === 'current' ? '选择当前粮' : '选择目标粮',
      foodOptions: [],
      loadingFoods: true,
    });
    try {
      const response = await request(`${config.apiBaseUrl}/api/miniprogram/products?brand=${encodeURIComponent(selectedFood.brand)}&limit=50`);
      const items = (response.data && response.data.items) || [];
      this.setData({
        loadingFoods: false,
        foodOptions: items.map((item) => ({
          id: item.catalog_key,
          productKey: item.product_key,
          brand: item.brand,
          name: item.product_name,
          emoji: foodType === 'current' ? '🐱' : '🥣',
          selected: item.catalog_key === selectedFood.id,
        })),
      });
    } catch (error) {
      this.setData({ loadingFoods: false });
      wx.showToast({ title: (error.data && error.data.error) || '产品加载失败', icon: 'none' });
    }
  },

  async chooseFood(event) {
    const food = this.data.foodOptions.find((item) => item.id === event.currentTarget.dataset.id);
    if (!food) return;
    const foodType = this.data.foodType;
    this.setData({ [`${foodType}Food`]: food, showFoodSheet: false, tested: false });
    wx.showTabBar({ animation: true });
    try {
      const response = await request(`${config.apiBaseUrl}/api/miniprogram/products/ingredients`, 'POST', { catalog_key: food.id });
      const groups = mapIngredientGroups(response.data && response.data.ingredient_analysis);
      const groupKey = foodType === 'current' ? 'currentIngredientGroups' : 'targetIngredientGroups';
      const matchedKey = foodType === 'current' ? 'currentFoodMatched' : 'targetFoodMatched';
      const updates = { [groupKey]: groups, [matchedKey]: !!(response.data && response.data.ingredient_analysis) };
      if (this.data.activeFoodTab === foodType) {
        updates.ingredientGroups = groups;
        updates.activeFoodTitle = `${food.brand} ${food.name}`;
        updates.activeFoodMatched = updates[matchedKey];
      }
      this.setData(updates);
    } catch (error) {
      wx.showToast({ title: (error.data && error.data.error) || '配料加载失败', icon: 'none' });
    }
  },

  openSymptoms() {
    wx.hideTabBar({ animation: true });
    this.setData({ showSymptomSheet: true });
  },
  closeSheet() {
    this.setData({ showFoodSheet: false, showSymptomSheet: false });
    wx.showTabBar({ animation: true });
  },

  toggleSymptom(event) {
    const label = event.currentTarget.dataset.label;
    let selected = [...this.data.selectedSymptoms];
    if (label === '无明显异常') {
      selected = selected.includes(label) ? [] : [label];
    } else {
      selected = selected.filter((item) => item !== '无明显异常');
      selected = selected.includes(label) ? selected.filter((item) => item !== label) : [...selected, label];
    }
    this.setData({
      selectedSymptoms: selected,
      symptomOptions: SYMPTOMS.map((item) => ({ label: item, selected: selected.includes(item) })),
      tested: false,
    });
  },

  confirmSymptoms() {
    if (!this.data.selectedSymptoms.length) {
      wx.showToast({ title: '请至少选择一项', icon: 'none' });
      return;
    }
    this.setData({ symptomText: this.data.selectedSymptoms.join(' / '), showSymptomSheet: false });
    wx.showTabBar({ animation: true });
  },

  onMessageInput(event) {
    this.setData({ inputMessage: event.detail.value });
  },

  async sendMessage() {
    const message = this.data.inputMessage.trim();
    if (!message || this.data.sending) return;
    this.setData({
      sending: true,
      inputMessage: '',
      userMessage: message,
      assistantMessage: '正在识别换粮意图和猫咪状态…',
      recognized: false,
      tested: false,
    });
    try {
      const userInfo = wx.getStorageSync('userInfo') || {};
      const sessionId = wx.getStorageSync('food_change_session_id') || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      wx.setStorageSync('food_change_session_id', sessionId);
      const response = await request(`${config.apiBaseUrl}/api/miniprogram/food-change/intent`, 'POST', {
        user_id: userInfo.openid || userInfo.id || '',
        session_id: sessionId,
        message,
      });
      const data = response.data || {};
      const intent = data.intent || {};
      const current = intent.current_food || {};
      const target = intent.target_food || {};
      const symptoms = (intent.cat_status && intent.cat_status.symptoms) || [];
      const currentMatch = data.product_match || {};
      const targetMatch = data.target_product_match || {};
      const currentIngredientGroups = mapIngredientGroups(data.ingredient_analysis);
      const targetIngredientGroups = mapIngredientGroups(data.target_ingredient_analysis);
      const missingProductNames = [];
      if (!current.product_name && !intent.product_name) missingProductNames.push('当前粮');
      if (!target.product_name) missingProductNames.push('目标粮');
      this.setData({
        currentFood: {
          id: currentMatch.catalog_key || 'recognized-current',
          productKey: currentMatch.product_key || '',
          brand: currentMatch.brand || current.brand || intent.brand || '未识别',
          name: currentMatch.product_name || current.product_name || intent.product_name || '具体产品未识别',
          emoji: '🐱',
        },
        targetFood: {
          id: targetMatch.catalog_key || 'recognized-target',
          productKey: targetMatch.product_key || '',
          brand: targetMatch.brand || target.brand || '未识别',
          name: targetMatch.product_name || target.product_name || '具体产品未识别',
          emoji: '🥣',
        },
        selectedSymptoms: symptoms,
        symptomText: symptoms.length ? symptoms.join(' / ') : '暂无明显状态',
        assistantMessage: intent.is_food_change_intent
          ? (missingProductNames.length ? `已识别品牌，请补充${missingProductNames.join('和')}的具体产品或系列。` : '已识别换粮信息，请确认后开始检测。')
          : '暂未识别到明确的换粮意图，请补充当前粮、目标粮和猫咪状态。',
        recognized: !!intent.is_food_change_intent,
        activeFoodTab: 'current',
        currentIngredientGroups,
        targetIngredientGroups,
        ingredientGroups: currentIngredientGroups,
        activeFoodTitle: `${currentMatch.brand || current.brand || intent.brand || '未识别'} ${currentMatch.product_name || current.product_name || intent.product_name || '未识别'}`,
        activeFoodMatched: !!data.ingredient_analysis,
        currentFoodMatched: !!data.ingredient_analysis,
        targetFoodMatched: !!data.target_ingredient_analysis,
        sending: false,
      });
    } catch (error) {
      const apiError = error && error.data && error.data.error;
      const networkError = error && error.errMsg;
      const messageText = apiError || networkError || '接口连接失败，请确认后端服务已启动。';
      this.setData({ assistantMessage: messageText, sending: false });
    }
  },

  async startTest() {
    if (this.data.testing) return;
    this.setData({ testing: true, tested: false });
    try {
      const currentFood = this.data.currentFood;
      const targetFood = this.data.targetFood;
      const response = await request(`${config.apiBaseUrl}/api/cat-food-compare/compare`, 'POST', {
        current_food: `${currentFood.brand} ${currentFood.name}`,
        target_food: `${targetFood.brand} ${targetFood.name}`,
        current_product_key: currentFood.productKey || '',
        target_product_key: targetFood.productKey || '',
        current_display_brand: currentFood.brand,
        current_display_name: currentFood.name,
        target_display_brand: targetFood.brand,
        target_display_name: targetFood.name,
      });
      const comparison = response.data || {};
      const currentResult = comparison.current_food || {};
      const targetResult = comparison.target_food || {};
      const radarMetrics = mapRadarMetrics(currentResult.profile, targetResult.profile);
      const currentRoleGroups = mapMaterialRoles(currentResult.material_role_evidence, this.data.currentIngredientGroups);
      const targetRoleGroups = mapMaterialRoles(targetResult.material_role_evidence, this.data.targetIngredientGroups);
      this.setData({
        testing: false,
        tested: true,
        activeFoodTab: 'target',
        ingredientGroups: this.data.targetIngredientGroups,
        radarMetrics,
        currentRoleGroups,
        targetRoleGroups,
        roleGroups: targetRoleGroups,
      }, () => {
        wx.pageScrollTo({ scrollTop: 0, duration: 0 });
        this.drawRadar();
      });
    } catch (error) {
      const message = (error.data && error.data.error) || error.errMsg || '营养对比数据加载失败';
      this.setData({ testing: false });
      wx.showToast({ title: message, icon: 'none', duration: 3000 });
    }
  },

  drawRadar() {
    const query = wx.createSelectorQuery().in(this);
    query.select('#nutritionRadar').fields({ node: true, size: true }).exec((result) => {
      const item = result && result[0];
      if (!item || !item.node) return;
      const canvas = item.node;
      const ctx = canvas.getContext('2d');
      const dpr = wx.getWindowInfo().pixelRatio || 1;
      const width = item.width;
      const height = item.height;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      ctx.scale(dpr, dpr);

      const centerX = width / 2;
      const centerY = height / 2 + 6;
      const radius = Math.min(width, height) * 0.34;
      const angles = [-Math.PI / 2, -Math.PI / 6, Math.PI / 6, Math.PI / 2, (5 * Math.PI) / 6, (7 * Math.PI) / 6];
      const point = (angle, scale) => ({ x: centerX + Math.cos(angle) * radius * scale, y: centerY + Math.sin(angle) * radius * scale });
      const polygon = (scale) => angles.map((angle) => point(angle, scale));
      const drawPath = (points, close = true) => {
        ctx.beginPath();
        points.forEach((p, index) => index ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y));
        if (close) ctx.closePath();
      };

      ctx.lineWidth = 1;
      [1, 0.75, 0.5, 0.25].forEach((scale) => {
        drawPath(polygon(scale));
        ctx.strokeStyle = '#ece8e3';
        ctx.stroke();
      });
      angles.forEach((angle) => {
        const end = point(angle, 1);
        ctx.beginPath();
        ctx.moveTo(centerX, centerY);
        ctx.lineTo(end.x, end.y);
        ctx.strokeStyle = '#eeeae6';
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

      const currentValues = this.data.radarMetrics.map((metric) => metric.current);
      const targetValues = this.data.radarMetrics.map((metric) => metric.target);
      drawSeries(targetValues, '#68a346', 'rgba(104,163,70,.08)');
      drawSeries(currentValues, '#ff5d4f', 'rgba(255,93,79,.09)');
    });
  },

  switchFoodTab(event) {
    const activeFoodTab = event.currentTarget.dataset.tab;
    this.setData({
      activeFoodTab,
      activeFoodTitle: activeFoodTab === 'current'
        ? `${this.data.currentFood.brand} ${this.data.currentFood.name}`
        : `${this.data.targetFood.brand} ${this.data.targetFood.name}`,
      activeFoodMatched: activeFoodTab === 'current' ? this.data.currentFoodMatched : this.data.targetFoodMatched,
      ingredientGroups: activeFoodTab === 'current' ? this.data.currentIngredientGroups : this.data.targetIngredientGroups,
      roleGroups: activeFoodTab === 'current' ? this.data.currentRoleGroups : this.data.targetRoleGroups,
      activeTooltip: '',
    });
  },

  toggleTooltip(event) {
    const id = event.currentTarget.dataset.id;
    this.setData({ activeTooltip: this.data.activeTooltip === id ? '' : id });
  },

  clearTooltip() {
    if (this.data.activeTooltip) this.setData({ activeTooltip: '' });
  },

  comingSoon() { wx.showToast({ title: '下一阶段开放', icon: 'none' }); },
});
