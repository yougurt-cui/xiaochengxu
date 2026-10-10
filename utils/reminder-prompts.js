// Copy is local, separate from each account's actual reminders.
const KEY = 'pet_reminder_prompts_v1';
const prompts = [
  { type: 'litter', text: '是不是该清理猫砂盆了？' },
  { type: 'food', text: '是不是该买粮食了？' },
  { type: 'internal', text: '是不是该安排驱虫了？' },
  { type: 'pump', text: '是不是该清洁水泵了？' },
  { type: 'bath', text: '是不是该安排洗澡了？' },
  { type: 'checkup', text: '是不是该安排体检了？' },
  { type: 'vaccine', text: '是不是该查看疫苗计划了？' },
  { type: 'groom', text: '是不是该梳理毛发了？' },
  { type: 'drum', text: '是不是该清洗滚筒了？' },
  { type: 'waste', text: '是不是该清理集便仓了？' },
  { type: 'fountain', text: '是不是该清洁饮水机了？' },
  { type: 'refill', text: '是不是该给饮水机添水了？' },
];
let currentPrompt;
export function chooseReminderPrompt() {
  let saved;
  try {
    saved = wx.getStorageSync(KEY);
  } catch (_) {
    /* Storage may be unavailable. */
  }
  const options = prompts.filter((p) => p.text !== (currentPrompt || saved?.selected));
  currentPrompt = options[Math.floor(Math.random() * options.length)].text;
  try {
    wx.setStorageSync(KEY, { prompts, selected: currentPrompt });
  } catch (_) {
    /* Keep the session copy usable. */
  }
  return currentPrompt;
}
export function getReminderPrompt() {
  return currentPrompt || chooseReminderPrompt();
}
