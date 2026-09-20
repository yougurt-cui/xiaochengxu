/* eslint-disable */
var __request = wx.request;
var Mock = require('./mock.js');
Object.defineProperty(wx, 'request', { writable: true });
wx.request = function (config) {
  if (typeof Mock._mocked[config.url] == 'undefined') {
    return __request(config);
  }
  var resTemplate = Mock._mocked[config.url].template;
  var response = Mock.mock(resTemplate);
  if (typeof config.success == 'function') {
    config.success(response);
  }
  if (typeof config.complete == 'function') {
    config.complete(response);
  }
};
module.exports = Mock;
