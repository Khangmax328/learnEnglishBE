const OpenAI = require('openai');

let _client = null;
function getClient() {
  if (_client) return _client;
  const key = process.env.OPENAI_API_KEY;
  if (!key || !key.trim()) {
    throw new Error('OPENAI_API_KEY is missing. Set it in .env');
  }
  _client = new OpenAI({ apiKey: key });
  return _client;
}

async function correctWithAI(userText) {
  const client = getClient();
  const resp = await client.chat.completions.create({
    model: 'gpt-4o-mini',
    temperature: 0,
    messages: [
      { role: 'system', content: 'You are an English proofreader. Return ONLY the corrected sentence(s), no quotes, no extra text.' },
      { role: 'user', content: userText }
    ]
  });
  const out = resp.choices?.[0]?.message?.content?.trim() || '';
  return out || userText; 
}


async function translateToVi(textEn) {
  const client = getClient();
  const resp = await client.chat.completions.create({
    model: 'gpt-4o-mini',
    temperature: 0,
    messages: [
      { role: 'system', content: 'Bạn là dịch giả chuyên nghiệp. Hãy dịch sang tiếng Việt. Chỉ trả về bản dịch, không kèm giải thích hay ký hiệu trích dẫn.' },
      { role: 'user', content: textEn }
    ]
  });
  const out = resp.choices?.[0]?.message?.content?.trim() || '';
  return out; 
}

module.exports = { correctWithAI, translateToVi };