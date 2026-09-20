import config from './config';
import createBus from './utils/eventBus';

App({
  onLaunch() {
    const updateManager = wx.getUpdateManager();

    updateManager.onCheckForUpdate(() => {});

    updateManager.onUpdateReady(() => {
      wx.showModal({
        title: '更新提示',
        content: '新版本已经准备好，是否重启应用？',
        success(res) {
          if (res.confirm) {
            updateManager.applyUpdate();
          }
        },
      });
    });

    if (config.isMock) {
      // Keep mock out of the production main package; only load when enabled.
      // eslint-disable-next-line global-require, import/no-extraneous-dependencies
      const mockModule = require('./mock/index');
      const Mock = mockModule.default || mockModule;
      Mock();
      this.getUnreadNum();
      this.connect();
    }
  },
  globalData: {
    userInfo: null,
    unreadNum: 0,
    socket: null,
  },

  eventBus: createBus(),

  connect() {
    if (!config.isMock) return;
    // eslint-disable-next-line global-require
    const { connectSocket } = require('./mock/chat');
    const socket = connectSocket();
    socket.onMessage((data) => {
      const payload = JSON.parse(data);
      if (payload.type === 'message' && !payload.data.message.read) {
        this.setUnreadNum(this.globalData.unreadNum + 1);
      }
    });
    this.globalData.socket = socket;
  },

  getUnreadNum() {
    if (!config.isMock) return;
    // eslint-disable-next-line global-require
    const { fetchUnreadNum } = require('./mock/chat');
    fetchUnreadNum().then(({ data }) => {
      this.globalData.unreadNum = data;
      this.eventBus.emit('unread-num-change', data);
    });
  },

  setUnreadNum(unreadNum) {
    this.globalData.unreadNum = unreadNum;
    this.eventBus.emit('unread-num-change', unreadNum);
  },
});
