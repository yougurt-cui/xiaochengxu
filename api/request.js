import config from '~/config';

const { baseUrl } = config;
const delay = config.isMock ? 500 : 0;
function request(url, method = 'GET', data = {}) {
  const header = {
    'content-type': 'application/json',
    // 有其他content-type需求加点逻辑判断处理即可
  };
  // 获取token，有就丢进请求头
  const tokenString = wx.getStorageSync('miniprogram_token');
  if (tokenString) {
    header.Authorization = `Bearer ${tokenString}`;
  }
  let task;
  const promise = new Promise((resolve, reject) => {
    task = wx.request({
      url: /^https?:\/\//.test(url) ? url : baseUrl + url,
      timeout: 30000,
      method,
      data,
      dataType: 'json', // 微信官方文档中介绍会对数据进行一次JSON.parse
      header,
      success(res) {
        setTimeout(() => {
          // HTTP状态码为200才视为成功
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(res);
          } else {
            // wx.request的特性，只要有响应就会走success回调，所以在这里判断状态，非200的均视为请求失败
            reject(res);
          }
        }, delay);
      },
      fail(err) {
        setTimeout(() => {
          // 断网、服务器挂了都会fail回调，直接reject即可
          reject(err);
        }, delay);
      },
    });
  });
  promise.abort = () => {
    if (task) task.abort();
  };
  return promise;
}

// 导出请求和服务地址
export default request;
