export function birthdayAge(birthday, now = new Date()) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(birthday || '')) throw new Error('请选择有效生日');
  const [y, m, d] = birthday.split('-').map(Number);
  const born = new Date(y, m - 1, d);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (born.getFullYear() !== y || born.getMonth() !== m - 1 || born.getDate() !== d || born > today)
    throw new Error('生日不能晚于今天');
  let months = (today.getFullYear() - y) * 12 + today.getMonth() - (m - 1);
  const anniversary = Math.min(d, new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate());
  if (today.getDate() < anniversary) months--;
  if (months > 360) throw new Error('年龄需在 30 岁以内');
  const years = Math.floor(months / 12),
    rest = months % 12;
  const text = months === 0 ? '未满1个月' : `${years ? years + '岁' : ''}${rest ? rest + '个月' : ''}`;
  return { age: text, age_text: text, age_months: months };
}
export function profileTags(value) {
  const tags = [
    ...new Set(
      String(value || '')
        .split(/[,，、;；\n]/)
        .map((v) => v.trim())
        .filter(Boolean),
    ),
  ];
  if (tags.length > 30 || tags.some((v) => v.length > 64)) throw new Error('每项最多 64 字，最多填写 30 项');
  return tags;
}
export function profileForm(p) {
  const form = {
    name: '',
    type: '猫咪',
    animal_type: 'cat',
    breed: '',
    sex: 'unknown',
    neutered: null,
    birthday: '',
    age: '',
    weight: '',
    ...p,
  };
  form.sex = { 公: 'male', 母: 'female', 未知: 'unknown' }[form.sex] || form.sex || 'unknown';
  form.neutered = form.neutered == null ? null : !!form.neutered;
  for (const key of ['allergies', 'diseases', 'symptoms', 'health_status'])
    form[key + 'Text'] = (form[key] || []).join('、');
  form.allergyChoice = form.allergies && form.allergies.length ? 'yes' : 'unknown';
  if (form.birthday) Object.assign(form, birthdayAge(form.birthday));
  return form;
}
export function profilePayload(f) {
  if (!String(f.name || '').trim()) throw new Error('请填写宠物名称');
  const payload = {
    name: f.name.trim(),
    animal_type: f.animal_type || 'cat',
    breed: (f.breed || '').trim(),
    sex: f.sex || 'unknown',
    neutered: f.neutered,
    food_brand: (f.food_brand || '').trim(),
    food_product: (f.food_product || '').trim(),
    notes: (f.notes || '').trim(),
    is_default: true,
    allergies: f.allergyChoice === 'no' ? [] : profileTags(f.allergiesText),
    diseases: profileTags(f.diseasesText),
    symptoms: profileTags(f.symptomsText),
    health_status: profileTags(f.health_statusText),
  };
  if (f.avatar_image_id) payload.avatar_image_id = f.avatar_image_id;
  if (f.birthday) Object.assign(payload, { birthday: f.birthday }, birthdayAge(f.birthday));
  else if (f.birthdayCleared) Object.assign(payload, { birthday: '', age: '', age_text: '', age_months: null });
  // Preserve an existing age when editing a legacy profile without a birthday.
  if (f.weight !== '' && f.weight != null) {
    const weight = Number(f.weight);
    if (!Number.isFinite(weight) || weight < 0.1 || weight > 30) throw new Error('体重请填写 0.1～30 kg');
    payload.weight_kg = weight;
  } else if (f.id) payload.weight_kg = null;
  return payload;
}
