const CATEGORIES = [
  { id: 'funny', emoji: '😹', label: '搞笑瞬间' },
  { id: 'sleep', emoji: '🌙', label: '睡姿大赏' },
  { id: 'eat', emoji: '🥣', label: '干饭现场' },
  { id: 'chin', emoji: '🐱', label: '黑下巴观察' },
  { id: 'diary', emoji: '📔', label: '换粮日记' },
  { id: 'cute', emoji: '💗', label: '今日可爱' },
];

const POSTS = [
  { id: 1, category: 'funny', tag: '搞笑瞬间', emoji: '😹', image: '/static/moments/cat-1.webp', title: '这表情管理完全失控了 🤣', author: '芝士奶盖', avatar: '🐱', likes: 342, comments: 18 },
  { id: 2, category: 'sleep', tag: '睡姿大赏', emoji: '🌙', image: '/static/moments/cat-2.webp', title: '睡成这样，还能找到头？', author: '一只小团子', avatar: '🌑', likes: 268, comments: 14 },
  { id: 3, category: 'cute', tag: '今日可爱', emoji: '💗', image: '/static/moments/cat-3.webp', title: '被窝是本喵的安全屋 🏠', author: '棉花糖', avatar: '🧶', likes: 315, comments: 22 },
  { id: 4, category: 'eat', tag: '干饭现场', emoji: '🥣', image: '/static/moments/cat-4.webp', title: '开饭前的专注凝视 😺', author: '饭团麻麻', avatar: '👩🏻', likes: 274, comments: 9 },
  { id: 5, category: 'chin', tag: '黑下巴观察', emoji: '🐱', image: '/static/moments/cat-5.webp', title: '黑下巴又来报道了 😅', author: '铲屎官小李', avatar: '🐾', likes: 192, comments: 16 },
  { id: 6, category: 'sleep', tag: '睡姿大赏', emoji: '🌙', image: '/static/moments/cat-6.webp', title: '四脚朝天，毫无防备 😴', author: '奶油小方', avatar: '🐈', likes: 241, comments: 11 },
];

function splitColumns(posts) {
  return {
    leftPosts: posts.filter((_, index) => index % 2 === 0),
    rightPosts: posts.filter((_, index) => index % 2 === 1),
  };
}

Page({
  data: {
    statusBarHeight: 20,
    categories: CATEGORIES.map((item) => ({ ...item, active: item.id === 'funny' })),
    activeCategory: 'funny',
    ...splitColumns(POSTS),
  },

  onLoad() {
    const { statusBarHeight = 20 } = wx.getWindowInfo();
    this.setData({ statusBarHeight });
  },

  onShow() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ value: 'message' });
    }
  },

  selectCategory(event) {
    const id = event.currentTarget.dataset.id;
    const posts = id === this.data.activeCategory ? POSTS : POSTS.filter((item) => item.category === id);
    const nextId = id === this.data.activeCategory ? 'all' : id;
    this.setData({
      activeCategory: nextId,
      categories: CATEGORIES.map((item) => ({ ...item, active: item.id === nextId })),
      ...splitColumns(nextId === 'all' ? POSTS : posts),
    });
  },

  toggleLike(event) {
    const id = Number(event.currentTarget.dataset.id);
    const update = (items) => items.map((item) => item.id === id ? { ...item, liked: !item.liked, likes: item.likes + (item.liked ? -1 : 1) } : item);
    this.setData({ leftPosts: update(this.data.leftPosts), rightPosts: update(this.data.rightPosts) });
  },

  comingSoon() { wx.showToast({ title: '下一阶段开放', icon: 'none' }); },
});
