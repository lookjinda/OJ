#!/usr/bin/env node

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const ROOT = path.resolve(__dirname, '../..');
const DB_PATH = process.env.DB_PATH || path.join(ROOT, 'database.sqlite');
const MEDIA_DIR = process.env.MEDIA_DIR || path.join(ROOT, 'media');
const PUBLIC_MEDIA_PREFIX = process.env.PUBLIC_MEDIA_PREFIX || '/media';
const ACCOUNT = process.env.LIANKE_ACCOUNT || '13161612656';
const PASSWORD = process.env.LIANKE_PASSWORD;
const BASE = 'https://center.liankexue.cn';
const API = `${BASE}/kepu/link-science`;
const LOGIN_API = `${BASE}/kepu/user/authTokenByPassword`;

const args = new Map(process.argv.slice(2).map((arg) => {
  const [key, ...rest] = arg.replace(/^--/, '').split('=');
  return [key, rest.length ? rest.join('=') : 'true'];
}));

const LIMIT = Number(args.get('limit') || 0);
const DRY_RUN = args.get('dry-run') === 'true';
const REPAIR_IMAGES = args.get('repair-images') === 'true';
const ONLY = String(args.get('only') || 'scratch,python,cpp').split(',').map((x) => x.trim().toLowerCase()).filter(Boolean);

if (!PASSWORD) {
  console.error('Missing LIANKE_PASSWORD. Example: LIANKE_PASSWORD=... node backend/scripts/import-lianke-exams.js');
  process.exit(1);
}

function md5(text) {
  return crypto.createHash('md5').update(text).digest('hex');
}

function stripHtml(html) {
  return String(html || '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

function isBlankHtml(value) {
  return !stripHtml(value) && !/<img\b/i.test(String(value || ''));
}

function chineseLevel(title) {
  const match = String(title || '').match(/([一二三四五六七八九十]+级)/);
  if (match) return match[1];
  if (/CSP-J/i.test(title)) return 'CSP-J';
  if (/CSP-S/i.test(title)) return 'CSP-S';
  return '';
}

function examDateKey(title, year) {
  const text = String(title || '');
  let match = text.match(/(20\d{2})(0[1-9]|1[0-2])/);
  if (match) return `${match[1]}${match[2]}`;
  match = text.match(/\b([2-9]\d)(0[1-9]|1[0-2])/);
  if (match) return `20${match[1]}${match[2]}`;
  match = text.match(/(20\d{2})\s*年\s*(\d{1,2})\s*月/);
  if (match) return `${match[1]}${String(match[2]).padStart(2, '0')}`;
  match = text.match(/(20\d{2})/);
  if (match) return match[1];
  return year ? String(year) : '';
}

function displayDate(key) {
  if (/^20\d{4}$/.test(key)) return `${key.slice(0, 4)}年${key.slice(4)}月`;
  if (/^20\d{2}$/.test(key)) return `${key}年`;
  return '';
}

function languageOf(title) {
  const text = String(title || '');
  if (/Scratch|图形化/i.test(text)) return 'scratch';
  if (/Python/i.test(text)) return 'python';
  if (/C\+\+|CSP|NOIP|NOI|GESP\s*C\+\+/i.test(text)) return 'cpp';
  return 'other';
}

function contestOf(title) {
  const text = String(title || '');
  if (/CSP/i.test(text)) return 'CSP';
  if (/GESP/i.test(text)) return 'GESP';
  return '电子学会';
}

function languageLabel(language) {
  if (language === 'scratch') return 'Scratch';
  if (language === 'python') return 'Python';
  if (language === 'cpp') return 'C++';
  return '编程';
}

function examSignature(title, year) {
  const level = chineseLevel(title);
  const fallback = level ? '' : stripHtml(title).replace(/\s+/g, '').slice(0, 40);
  return [
    contestOf(title),
    languageOf(title),
    level || fallback,
    examDateKey(title, year),
  ].join('|').toLowerCase();
}

function formatExamTitle(source) {
  const contest = contestOf(source.title);
  const language = languageLabel(languageOf(source.title));
  const level = chineseLevel(source.title);
  const date = displayDate(examDateKey(source.title, source.year));
  const tail = /模拟/.test(source.title) ? '模拟题' : /试卷/.test(source.title) ? '试卷' : '真题';
  if (!level) {
    return [contest, language, date, stripHtml(source.title)].filter(Boolean).join(' ');
  }
  return [contest, language, level, date, tail].filter(Boolean).join(' ');
}

function difficultyOf(value) {
  const n = Number(value || 0);
  if (n <= 2) return 'easy';
  if (n >= 4) return 'hard';
  return 'medium';
}

function imageExtFrom(url, contentType) {
  const clean = String(url).split('?')[0];
  const ext = path.extname(clean).toLowerCase();
  if (['.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp'].includes(ext)) return ext;
  if (/png/i.test(contentType || '')) return '.png';
  if (/webp/i.test(contentType || '')) return '.webp';
  if (/gif/i.test(contentType || '')) return '.gif';
  return '.jpg';
}

async function login() {
  const password = md5(PASSWORD).toLowerCase();
  const res = await fetch(LOGIN_API, {
    method: 'POST',
    headers: { 'content-type': 'application/json', platform: 'kp' },
    body: JSON.stringify({ password, userAccount: ACCOUNT, clientId: 'npsc-link-science' }),
  });
  const json = await res.json();
  if (json.code !== 200 || !json.data?.access_token) {
    throw new Error(`Lianke login failed: ${json.msg || res.status}`);
  }
  return json.data.access_token;
}

async function apiGet(pathname, token, params = {}) {
  const url = new URL(`${API}${pathname}`);
  Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));
  const res = await fetch(url, { headers: { platform: 'kp', kp_Authorization: token } });
  const json = await res.json();
  if (json.code !== 200) throw new Error(`${pathname} failed: ${json.msg || res.status}`);
  return json.data;
}

async function downloadImage(url, examSourceId) {
  const hash = md5(url);
  const dir = path.join(MEDIA_DIR, 'lianke', String(examSourceId));
  fs.mkdirSync(dir, { recursive: true });

  let target = null;
  for (const ext of ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp']) {
    const candidate = path.join(dir, `${hash}${ext}`);
    if (fs.existsSync(candidate)) {
      target = candidate;
      break;
    }
  }

  if (!target) {
    const res = await fetch(encodeURI(url));
    if (!res.ok) throw new Error(`image ${url} failed: ${res.status}`);
    const contentType = res.headers.get('content-type') || '';
    const ext = imageExtFrom(url, contentType);
    target = path.join(dir, `${hash}${ext}`);
    const buffer = Buffer.from(await res.arrayBuffer());
    fs.writeFileSync(target, buffer);
  }

  return `${PUBLIC_MEDIA_PREFIX}/lianke/${examSourceId}/${path.basename(target)}`;
}

async function localizeHtml(html, examSourceId, stats) {
  let output = String(html || '');
  const attrUrls = [...output.matchAll(/\b(?:src|data-href)=["']([^"']+)["']/gi)].map((m) => m[1]);
  const plainUrls = [...output.matchAll(/https?:\/\/[^"'<>\\\s]+?\.(?:png|jpe?g|gif|webp|bmp)(?:\?[^"'<>\\\s]*)?/gi)].map((m) => m[0]);
  const urls = [...new Set([...attrUrls, ...plainUrls]
    .map((url) => String(url || '').replace(/&amp;/g, '&').trim())
    .filter((url) => /^https?:\/\//i.test(url)))];

  for (const url of urls) {
    try {
      const local = await downloadImage(url, examSourceId);
      output = output.split(url).join(local);
      stats.images += 1;
    } catch (err) {
      stats.imageErrors += 1;
      console.warn(`WARN image kept remote: ${url} (${err.message})`);
    }
  }
  return output;
}

async function repairImages(db) {
  const rows = db.prepare(`
    SELECT id, source, content, options, answer
    FROM questions
    WHERE source LIKE '链科学:%'
      AND (content LIKE '%http%' OR options LIKE '%http%' OR answer LIKE '%http%')
  `).all();
  const update = db.prepare('UPDATE questions SET content = ?, options = ?, answer = ? WHERE id = ?');
  const stats = { rows: rows.length, updated: 0, images: 0, imageErrors: 0 };

  for (const row of rows) {
    const examSourceId = String(row.source || '').replace('链科学:', '') || 'unknown';
    const content = await localizeHtml(row.content || '', examSourceId, stats);
    const options = await localizeHtml(row.options || '', examSourceId, stats);
    const answer = await localizeHtml(row.answer || '', examSourceId, stats);
    if (content !== row.content || options !== row.options || answer !== row.answer) {
      update.run(content, options, answer, row.id);
      stats.updated += 1;
    }
  }
  console.log(JSON.stringify(stats, null, 2));
}

function questionTitle(question, index) {
  const plain = stripHtml(question.title);
  return plain ? plain.slice(0, 120) : `第${index + 1}题`;
}

function optionList(question) {
  const labels = ['A', 'B', 'C', 'D', 'E'];
  return labels.map((label) => ({ label, display: question[`option${label}`] }))
    .filter((option) => !isBlankHtml(option.display));
}

function judgeAnswer(value) {
  const normalized = String(value || '').trim().toUpperCase();
  if (normalized === '1' || normalized === 'TRUE' || normalized === '正确' || normalized === 'A') return 'A';
  if (normalized === '0' || normalized === 'FALSE' || normalized === '错误' || normalized === 'B') return 'B';
  return 'A';
}

async function mapQuestion(question, index, exam, language, stats) {
  const sourceId = exam.id;
  const localizedTitle = await localizeHtml(question.title || '', sourceId, stats);
  const localizedAnswer = await localizeHtml(question.answer || '', sourceId, stats);
  const localizedAnalyze = await localizeHtml(question.analyzeContent || '', sourceId, stats);
  const localizedOptions = [];
  for (const option of optionList(question)) {
    localizedOptions.push({
      label: option.label,
      display: await localizeHtml(option.display || '', sourceId, stats),
    });
  }

  if (question.type === 3) {
    return {
      title: questionTitle(question, index),
      type: 'choice',
      language,
      difficulty: difficultyOf(question.difficultyLevel),
      content: localizedTitle,
      options: JSON.stringify([
        { label: 'A', display: '正确' },
        { label: 'B', display: '错误' },
      ]),
      answer: judgeAnswer(question.answer),
      points: Number(question.score) || 2,
      tags: question.knowledgeNames || '',
      source: `链科学:${question.id}`,
      subtype: 'judge',
    };
  }

  if (question.type === 4) {
    const answerParts = [];
    if (!isBlankHtml(localizedAnswer)) answerParts.push(`<h3>参考答案</h3>${localizedAnswer}`);
    if (!isBlankHtml(localizedAnalyze)) answerParts.push(`<h3>答案解析</h3>${localizedAnalyze}`);
    return {
      title: questionTitle(question, index),
      type: 'programming',
      language,
      difficulty: difficultyOf(question.difficultyLevel),
      content: localizedTitle,
      options: null,
      answer: answerParts.join('\n') || '答案暂无',
      points: Number(question.score) || 15,
      tags: question.knowledgeNames || '',
      source: `链科学:${question.id}`,
      subtype: 'programming',
    };
  }

  return {
    title: questionTitle(question, index),
    type: 'choice',
    language,
    difficulty: difficultyOf(question.difficultyLevel),
    content: localizedTitle,
    options: JSON.stringify(localizedOptions),
    answer: String(question.answer || '').trim().toUpperCase(),
    points: Number(question.score) || 2,
    tags: question.knowledgeNames || '',
    source: `链科学:${question.id}`,
    subtype: 'choice',
  };
}

function existingSignatures(db) {
  const rows = db.prepare('SELECT title, description FROM exams').all();
  return new Set(rows.map((row) => {
    const original = String(row.description || '').match(/原卷：([^；;]+)/)?.[1];
    return examSignature(original || row.title, null);
  }));
}

function selectPriorityExams(exams, signatures) {
  const seen = new Set(signatures);
  return exams
    .map((exam) => ({ ...exam, language: languageOf(exam.title), signature: examSignature(exam.title, exam.year) }))
    .filter((exam) => ONLY.includes(exam.language))
    .filter((exam) => {
      if (seen.has(exam.signature)) return false;
      seen.add(exam.signature);
      return true;
    })
    .sort((a, b) => {
      const order = { scratch: 1, python: 2, cpp: 3 };
      return (order[a.language] || 9) - (order[b.language] || 9) || String(a.title).localeCompare(String(b.title), 'zh-CN');
    })
    .slice(0, LIMIT || undefined);
}

function insertExam(db, sourceExam, detail, mappedQuestions) {
  const title = formatExamTitle(sourceExam);
  const description = `来源：${contestOf(sourceExam.title)}；原卷：${sourceExam.title}；链科学ID：${sourceExam.id}`;
  const total = mappedQuestions.reduce((sum, question) => sum + (Number(question.points) || 0), 0) || 100;
  const tx = db.transaction(() => {
    const examResult = db.prepare(`
      INSERT INTO exams (title, description, difficulty, duration, total_score, question_count)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(title, description, chineseLevel(sourceExam.title), detail.previousExamTime || sourceExam.examTime || 60, total, mappedQuestions.length);

    const insertQuestion = db.prepare(`
      INSERT INTO questions (
        title, type, language, difficulty, content, options, answer, test_cases, scratch_template,
        points, tags, source, time_limit_ms, memory_limit_mb, is_public, subtype
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const insertExamQuestion = db.prepare('INSERT INTO exam_questions (exam_id, question_id, sort_order) VALUES (?, ?, ?)');

    mappedQuestions.forEach((question, index) => {
      const questionResult = insertQuestion.run(
        question.title,
        question.type,
        question.language,
        question.difficulty,
        question.content,
        question.options,
        question.answer,
        null,
        null,
        question.points,
        question.tags,
        question.source,
        1000,
        128,
        1,
        question.subtype
      );
      insertExamQuestion.run(examResult.lastInsertRowid, questionResult.lastInsertRowid, index + 1);
    });
    return examResult.lastInsertRowid;
  });
  return tx();
}

async function main() {
  const db = new Database(DB_PATH);
  if (REPAIR_IMAGES) {
    await repairImages(db);
    db.close();
    return;
  }

  const token = await login();
  const signatures = existingSignatures(db);
  const listJson = await apiGet('/subjxect/previousexamlist', token, { pageCurrent: 1, pageSize: 1000 });
  const selected = selectPriorityExams(listJson || [], signatures);
  const stats = { exams: 0, questions: 0, skipped: (listJson || []).length - selected.length, images: 0, imageErrors: 0 };

  console.log(`Selected ${selected.length} exams from ${(listJson || []).length}. DB=${DB_PATH}`);
  for (const exam of selected) {
    const title = formatExamTitle(exam);
    console.log(`- ${title} (${exam.title}, ${exam.subjectNum || 0} questions)`);
    if (DRY_RUN) continue;

    const detail = await apiGet('/subjxect/previousexaminfo', token, { id: exam.id });
    const questions = detail.subjectLevelList || [];
    const mapped = [];
    for (let i = 0; i < questions.length; i += 1) {
      mapped.push(await mapQuestion(questions[i], i, exam, exam.language, stats));
    }
    insertExam(db, exam, detail, mapped);
    stats.exams += 1;
    stats.questions += mapped.length;
    signatures.add(exam.signature);
  }

  console.log(JSON.stringify(stats, null, 2));
  db.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
