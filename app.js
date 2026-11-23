/* PRO 연습장 — 패드용 컴파일/테스트 도구
 * 코드는 Wandbox(https://wandbox.org) 공개 API로 컴파일·실행합니다.
 * 모든 데이터는 이 브라우저의 localStorage에만 저장됩니다.
 */
(function () {
  'use strict';

  const API = 'https://wandbox.org/api';
  const STORE_KEY = 'proide.v1';
  const PREF_KEY = 'proide.prefs.v1';
  const LIST_KEY = 'proide.compilers.v1';

  // ---------- Language definitions ----------
  const LANGS = {
    cpp: {
      label: 'C++', wandboxLang: 'C++', mainName: 'prog.cc', mode: 'text/x-c++src',
      prefer: [/^gcc-13\./, /^gcc-1[0-9]\./, /^gcc-/], flags: '-O2 -std=c++17',
      fallback: ['gcc-13.2.0', 'gcc-12.3.0', 'clang-17.0.1', 'gcc-head'],
      srcExt: /\.(cpp|cc|cxx|c\+\+)$/i,
    },
    c: {
      label: 'C', wandboxLang: 'C', mainName: 'prog.c', mode: 'text/x-csrc',
      prefer: [/^gcc-13\..*-c$/, /^gcc-1[0-9]\..*-c$/, /^gcc-.*-c$/], flags: '-O2 -std=c11',
      fallback: ['gcc-13.2.0-c', 'gcc-12.3.0-c', 'clang-17.0.1-c'],
      srcExt: /\.c$/i,
    },
    java: {
      label: 'Java', wandboxLang: 'Java', mainName: 'prog.java', mode: 'text/x-java',
      prefer: [/jdk-21/, /jdk-/], flags: null,
      fallback: ['openjdk-jdk-21+35', 'openjdk-jdk-22+36'],
      srcExt: null,
    },
    python: {
      label: 'Python', wandboxLang: 'Python', mainName: 'prog.py', mode: 'text/x-python',
      prefer: [/^cpython-3\.12\./, /^cpython-3\.1[0-9]\./, /^cpython-3/], flags: null,
      fallback: ['cpython-3.12.16', 'cpython-3.13.18'],
      srcExt: null,
    },
  };

  // ---------- Templates (Pro 시험처럼 main + 사용자 솔루션 구조) ----------
  const SAMPLE_IN = '2\n3\n1 2 3\n2\n10 20\n';
  const SAMPLE_OUT = '#1 6\n#2 30\n';
  const TEMPLATES = {
    cpp: [
      { name: 'main.cpp', code:
`#include <cstdio>

extern void init(int N);
extern int add(int x);

int main() {
    // freopen("sample_input.txt", "r", stdin);
    int T;
    scanf("%d", &T);
    for (int tc = 1; tc <= T; ++tc) {
        int N;
        scanf("%d", &N);
        init(N);
        int sum = 0;
        for (int i = 0; i < N; ++i) {
            int x;
            scanf("%d", &x);
            sum = add(x);
        }
        printf("#%d %d\\n", tc, sum);
    }
    return 0;
}
` },
      { name: 'solution.cpp', code:
`static int total;

void init(int N) {
    total = 0;
}

int add(int x) {
    total += x;
    return total;
}
` },
    ],
    c: [
      { name: 'main.c', code:
`#include <stdio.h>

extern void init(int N);
extern int add(int x);

int main(void) {
    int T;
    scanf("%d", &T);
    for (int tc = 1; tc <= T; ++tc) {
        int N;
        scanf("%d", &N);
        init(N);
        int sum = 0;
        for (int i = 0; i < N; ++i) {
            int x;
            scanf("%d", &x);
            sum = add(x);
        }
        printf("#%d %d\\n", tc, sum);
    }
    return 0;
}
` },
      { name: 'solution.c', code:
`static int total;

void init(int N) {
    total = 0;
}

int add(int x) {
    total += x;
    return total;
}
` },
    ],
    java: [
      { name: 'Solution.java', code:
`import java.io.*;
import java.util.*;

public class Solution {
    public static void main(String[] args) throws IOException {
        BufferedReader br = new BufferedReader(new InputStreamReader(System.in));
        StringTokenizer st = new StringTokenizer(br.readLine());
        int T = Integer.parseInt(st.nextToken());
        UserSolution us = new UserSolution();
        StringBuilder sb = new StringBuilder();
        for (int tc = 1; tc <= T; tc++) {
            int N = Integer.parseInt(br.readLine().trim());
            us.init(N);
            st = new StringTokenizer(br.readLine());
            int sum = 0;
            for (int i = 0; i < N; i++) sum = us.add(Integer.parseInt(st.nextToken()));
            sb.append('#').append(tc).append(' ').append(sum).append('\\n');
        }
        System.out.print(sb);
    }
}
` },
      { name: 'UserSolution.java', code:
`class UserSolution {
    private int total;

    void init(int N) {
        total = 0;
    }

    int add(int x) {
        total += x;
        return total;
    }
}
` },
    ],
    python: [
      { name: 'main.py', code:
`import sys
from solution import init, add

def main():
    data = sys.stdin.read().split()
    p = 0
    T = int(data[p]); p += 1
    out = []
    for tc in range(1, T + 1):
        N = int(data[p]); p += 1
        init(N)
        s = 0
        for _ in range(N):
            s = add(int(data[p])); p += 1
        out.append(f"#{tc} {s}")
    print("\\n".join(out))

main()
` },
      { name: 'solution.py', code:
`total = 0

def init(N):
    global total
    total = 0

def add(x):
    global total
    total += x
    return total
` },
    ],
  };

  // ---------- Storage helpers ----------
  function load(key, def) {
    try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : def; } catch (e) { return def; }
  }
  function save(key, val) {
    try { localStorage.setItem(key, JSON.stringify(val)); } catch (e) { toast('저장 실패: 브라우저 저장소를 쓸 수 없습니다'); }
  }
  const uid = () => Math.random().toString(36).slice(2, 10);

  function newProject(name, lang) {
    return {
      id: uid(), name, lang, compiler: '', flags: LANGS[lang].flags || '',
      files: TEMPLATES[lang].map(f => ({ name: f.name, code: f.code })),
      tests: [{ input: SAMPLE_IN, expected: SAMPLE_OUT }],
      activeFile: 0, activeTest: 0, updated: Date.now(),
    };
  }

  let db = load(STORE_KEY, null);
  if (!db || !db.projects || !Object.keys(db.projects).length) {
    const p = newProject('예제 문제', 'cpp');
    db = { projects: { [p.id]: p }, current: p.id };
  }
  if (!db.projects[db.current]) db.current = Object.keys(db.projects)[0];

  const prefs = Object.assign({ theme: 'system', fontSize: 15, plain: false, keys: true }, load(PREF_KEY, {}));
  let compilerList = load(LIST_KEY, null); // [{name, language, version}]

  const P = () => db.projects[db.current];
  let saveTimer = null;
  function persist() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => { P().updated = Date.now(); save(STORE_KEY, db); }, 300);
  }
  window.addEventListener('pagehide', () => { clearTimeout(saveTimer); save(STORE_KEY, db); });
  document.addEventListener('visibilitychange', () => { if (document.hidden) { clearTimeout(saveTimer); save(STORE_KEY, db); } });

  // ---------- DOM ----------
  const $ = (id) => document.getElementById(id);
  const el = (tag, attrs, ...kids) => {
    const n = document.createElement(tag);
    if (attrs) for (const k in attrs) {
      if (k === 'class') n.className = attrs[k];
      else if (k.startsWith('on')) n.addEventListener(k.slice(2), attrs[k]);
      else if (attrs[k] !== false && attrs[k] != null) n.setAttribute(k, attrs[k] === true ? '' : attrs[k]);
    }
    for (const c of kids) if (c != null) n.append(c.nodeType ? c : document.createTextNode(c));
    return n;
  };

  function toast(msg) {
    const t = el('div', { class: 'toast', role: 'status' }, msg);
    document.body.append(t);
    setTimeout(() => t.remove(), 1800);
  }

  // ---------- Editor (CodeMirror or plain textarea) ----------
  const wrap = $('editorWrap');
  const plain = $('plain');
  let cm = null;
  let suppress = false;
  const docs = new Map(); // key: project.id + '/' + index -> CodeMirror.Doc

  function hasCM() { return typeof window.CodeMirror === 'function'; }

  function setupEditor() {
    if (cm) { cm.getWrapperElement().remove(); cm = null; }
    docs.clear();
    if (prefs.plain || !hasCM()) {
      plain.hidden = false;
      return;
    }
    plain.hidden = true;
    cm = CodeMirror(wrap, {
      lineNumbers: true, indentUnit: 4, tabSize: 4, indentWithTabs: false,
      matchBrackets: true, autoCloseBrackets: true, styleActiveLine: true,
      inputStyle: 'contenteditable', spellcheck: false, autocorrect: false, autocapitalize: false,
      extraKeys: {
        'Tab': (c) => c.somethingSelected() ? c.indentSelection('add') : c.replaceSelection('    ', 'end'),
        'Shift-Tab': (c) => c.indentSelection('subtract'),
        'Ctrl-/': 'toggleComment', 'Cmd-/': 'toggleComment',
        'Ctrl-Enter': () => runCurrent(), 'Cmd-Enter': () => runCurrent(),
        'Shift-Ctrl-Enter': () => runAll(), 'Shift-Cmd-Enter': () => runAll(),
        'Ctrl-S': () => { save(STORE_KEY, db); toast('저장됨'); }, 'Cmd-S': () => { save(STORE_KEY, db); toast('저장됨'); },
      },
    });
    cm.on('change', () => {
      if (suppress) return;
      const p = P();
      p.files[p.activeFile].code = cm.getValue();
      persist();
    });
  }

  function showFile() {
    const p = P();
    const f = p.files[p.activeFile];
    if (!f) return;
    if (cm) {
      const key = p.id + '/' + p.activeFile + '/' + f.name;
      let d = docs.get(key);
      if (!d || d.getValue() !== f.code) { d = CodeMirror.Doc(f.code, modeFor(f.name, p.lang)); docs.set(key, d); }
      suppress = true; cm.swapDoc(d); suppress = false;
      cm.setOption('mode', modeFor(f.name, p.lang));
      cm.refresh();
    } else {
      plain.value = f.code;
    }
  }

  function modeFor(name, lang) {
    if (/\.py$/i.test(name)) return 'text/x-python';
    if (/\.java$/i.test(name)) return 'text/x-java';
    if (/\.(c|h)$/i.test(name)) return lang === 'cpp' ? 'text/x-c++src' : 'text/x-csrc';
    if (/\.(cpp|cc|cxx|hpp|hh|hxx)$/i.test(name)) return 'text/x-c++src';
    if (/\.txt$/i.test(name)) return 'text/plain';
    return LANGS[lang].mode;
  }

  plain.addEventListener('input', () => { const p = P(); p.files[p.activeFile].code = plain.value; persist(); });
  plain.addEventListener('keydown', (e) => {
    if (e.key === 'Tab') { e.preventDefault(); insertText('    '); }
  });

  function editorFocus() { if (cm) cm.focus(); else plain.focus(); }

  function insertText(text, moveBack) {
    if (cm) {
      cm.replaceSelection(text, 'end');
      if (moveBack) { const c = cm.getCursor(); cm.setCursor({ line: c.line, ch: c.ch - moveBack }); }
      cm.focus();
    } else {
      const s = plain.selectionStart, e = plain.selectionEnd;
      plain.setRangeText(text, s, e, 'end');
      if (moveBack) { const pos = plain.selectionStart - moveBack; plain.setSelectionRange(pos, pos); }
      plain.dispatchEvent(new Event('input'));
      plain.focus();
    }
  }
  function moveCursor(dx, dy) {
    if (cm) {
      if (dy) cm.execCommand(dy < 0 ? 'goLineUp' : 'goLineDown');
      else cm.execCommand(dx < 0 ? 'goCharLeft' : 'goCharRight');
      cm.focus();
    } else if (dx) {
      const pos = Math.max(0, plain.selectionStart + dx);
      plain.setSelectionRange(pos, pos); plain.focus();
    }
  }
  function jumpTo(fileIdx, line) {
    const p = P();
    if (fileIdx !== p.activeFile) { p.activeFile = fileIdx; renderFileTabs(); showFile(); }
    if (cm) {
      const ln = Math.max(0, line - 1);
      cm.setCursor({ line: ln, ch: 0 });
      cm.scrollIntoView({ line: ln, ch: 0 }, 80);
      cm.addLineClass(ln, 'background', 'err-line');
      setTimeout(() => cm && cm.removeLineClass(ln, 'background', 'err-line'), 2500);
      cm.focus();
    } else {
      const lines = plain.value.split('\n');
      let pos = 0; for (let i = 0; i < line - 1 && i < lines.length; i++) pos += lines[i].length + 1;
      plain.focus(); plain.setSelectionRange(pos, pos);
    }
  }

  // ---------- Symbol keys ----------
  const KEYS = [
    ['Tab', '    ', 'wide'], ['{ }', '{}', '', 1], ['( )', '()', '', 1], ['[ ]', '[]', '', 1], ['sep'],
    [';'], ['<'], ['>'], ['='], ['&'], ['|'], ['!'], ['"'], ["'"], ['#'], ['sep'],
    ['+'], ['-'], ['*'], ['/'], ['%'], ['^'], [','], ['.'], [':'], ['_'], ['~'], ['\\'], ['sep'],
    ['←', null, 'wide', 0, () => moveCursor(-1)], ['→', null, 'wide', 0, () => moveCursor(1)],
    ['↑', null, 'wide', 0, () => moveCursor(0, -1)], ['↓', null, 'wide', 0, () => moveCursor(0, 1)], ['sep'],
    ['되돌리기', null, 'wide', 0, () => { if (cm) { cm.undo(); cm.focus(); } else document.execCommand('undo'); }],
    ['다시', null, 'wide', 0, () => { if (cm) { cm.redo(); cm.focus(); } else document.execCommand('redo'); }],
    ['주석', null, 'wide', 0, () => { if (cm) { cm.toggleComment(); cm.focus(); } }],
  ];
  function renderKeys() {
    const box = $('keys');
    box.innerHTML = '';
    box.hidden = !prefs.keys;
    for (const k of KEYS) {
      if (k[0] === 'sep') { box.append(el('span', { class: 'sep' })); continue; }
      const [label, text, cls, back, fn] = k;
      const b = el('button', { class: cls || '', type: 'button', 'aria-label': label }, label);
      // pointerdown + preventDefault keeps focus (and the iPad keyboard) in the editor
      b.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        if (fn) fn(); else insertText(text != null ? text : label, back || 0);
      });
      b.addEventListener('click', (e) => e.preventDefault());
      box.append(b);
    }
  }

  // ---------- File tabs ----------
  function renderFileTabs() {
    const p = P();
    const box = $('fileTabs');
    box.innerHTML = '';
    p.files.forEach((f, i) => {
      const t = el('button', { class: 'tab' + (i === p.activeFile ? ' active' : ''), type: 'button', title: i === 0 ? '실행 시작 파일 (main)' : f.name },
        i === 0 ? el('span', { class: 'main-dot' }) : null, f.name);
      t.addEventListener('click', () => {
        if (p.activeFile === i) { fileMenu(i); return; }
        p.activeFile = i; persist(); renderFileTabs(); showFile();
      });
      box.append(t);
    });
    box.append(el('button', { class: 'tab tab-add', type: 'button', title: '파일 추가', onclick: addFile }, '+ 파일'));
    const tools = el('div', { class: 'tabs-tools' },
      el('button', { class: 'btn small', type: 'button', title: '현재 파일 복사', onclick: copyFile }, '복사'),
      el('button', { class: 'btn small', type: 'button', title: '파일 메뉴', onclick: () => fileMenu(p.activeFile) }, '⋯'));
    box.append(tools);
  }

  function addFile() {
    const p = P();
    const ext = { cpp: '.cpp', c: '.c', java: '.java', python: '.py' }[p.lang];
    sheet('파일 추가', (body, close) => {
      const inp = el('input', { type: 'text', id: 'newFileName', value: 'sample_input.txt', autocapitalize: 'off', autocorrect: 'off', spellcheck: 'false' });
      const fileIn = el('input', { type: 'file', id: 'fileImport', multiple: true });
      body.append(
        el('p', null, `소스(${ext}), 헤더(.h), 입력 파일(sample_input.txt 등)을 추가할 수 있습니다. C/C++ 소스는 자동으로 함께 컴파일됩니다.`),
        inp,
        el('div', { class: 'row' },
          el('button', { class: 'btn primary', type: 'button', onclick: () => {
            const name = inp.value.trim();
            if (!validName(name)) return;
            p.files.push({ name, code: '' }); p.activeFile = p.files.length - 1;
            persist(); renderFileTabs(); showFile(); close(); editorFocus();
          } }, '빈 파일 만들기')),
        el('p', null, '또는 기기에 있는 파일 가져오기:'),
        fileIn);
      fileIn.addEventListener('change', async () => {
        for (const file of fileIn.files) {
          const text = await file.text();
          const ex = p.files.findIndex(f => f.name === file.name);
          if (ex >= 0) p.files[ex].code = text; else p.files.push({ name: file.name, code: text });
        }
        p.activeFile = p.files.length - 1; docs.clear();
        persist(); renderFileTabs(); showFile(); close(); toast('가져왔습니다');
      });
      setTimeout(() => { inp.focus(); inp.select(); }, 50);
    });
  }

  function validName(name, skip) {
    const p = P();
    if (!name || /[\/\\\s]/.test(name)) { toast('파일 이름에 공백이나 / 는 쓸 수 없습니다'); return false; }
    if (/^prog\.(cc|c|java|py)$/i.test(name)) { toast('prog.* 이름은 서버에서 예약되어 있습니다'); return false; }
    if (p.files.some((f, i) => i !== skip && f.name === name)) { toast('같은 이름의 파일이 있습니다'); return false; }
    return true;
  }

  function fileMenu(i) {
    const p = P();
    const f = p.files[i];
    sheet('파일: ' + f.name, (body, close) => {
      const inp = el('input', { type: 'text', id: 'renameFile', value: f.name, autocapitalize: 'off', autocorrect: 'off', spellcheck: 'false' });
      body.append(
        el('div', { class: 'row' }, inp,
          el('button', { class: 'btn', type: 'button', onclick: () => {
            const n = inp.value.trim();
            if (n === f.name) { close(); return; }
            if (!validName(n, i)) return;
            f.name = n; docs.clear(); persist(); renderFileTabs(); showFile(); close();
          } }, '이름 변경')));
      if (i !== 0) body.append(el('button', { class: 'btn', type: 'button', onclick: () => {
        const [m] = p.files.splice(i, 1); p.files.unshift(m); p.activeFile = 0; docs.clear();
        persist(); renderFileTabs(); showFile(); close(); toast(m.name + ' 을(를) 시작 파일로 지정');
      } }, '시작 파일(main)로 지정'));
      body.append(el('p', null, '첫 번째 파일(● 표시)이 프로그램의 시작 파일입니다.'));
      if (p.files.length > 1) {
        const del = el('button', { class: 'btn danger', type: 'button' }, '파일 삭제');
        let armed = false;
        del.addEventListener('click', () => {
          if (!armed) { armed = true; del.textContent = '한 번 더 눌러 삭제'; return; }
          p.files.splice(i, 1); p.activeFile = Math.max(0, Math.min(p.activeFile, p.files.length - 1)); docs.clear();
          persist(); renderFileTabs(); showFile(); close();
        });
        body.append(del);
      }
    });
  }

  async function copyText(text, okMsg) {
    try { await navigator.clipboard.writeText(text); toast(okMsg); }
    catch (e) { toast('복사할 수 없습니다. 직접 선택해 복사하세요'); }
  }
  function copyFile() { const p = P(); copyText(p.files[p.activeFile].code, '복사했습니다'); }

  // ---------- Tests ----------
  const testState = []; // per-index transient result: 'pass'|'fail'|'run'|undefined
  let lastOutput = null;

  function renderTestTabs() {
    const p = P();
    const box = $('testTabs');
    box.innerHTML = '';
    p.tests.forEach((t, i) => {
      const st = testState[i];
      const b = el('button', { class: 'tab' + (i === p.activeTest ? ' active' : ''), type: 'button' },
        el('span', { class: 'st' + (st ? ' ' + st : '') }), '테스트 ' + (i + 1));
      b.addEventListener('click', () => { p.activeTest = i; persist(); renderTestTabs(); showTest(); });
      box.append(b);
    });
    box.append(el('button', { class: 'tab tab-add', type: 'button', title: '테스트 추가', onclick: () => {
      p.tests.push({ input: '', expected: '' }); p.activeTest = p.tests.length - 1;
      persist(); renderTestTabs(); showTest(); $('tin').focus();
    } }, '+ 테스트'));
    if (p.tests.length > 1) {
      const del = el('button', { class: 'btn small', type: 'button', title: '현재 테스트 삭제' }, '삭제');
      let armed = false;
      del.addEventListener('click', () => {
        if (!armed) { armed = true; del.textContent = '확인'; del.classList.add('danger'); setTimeout(() => { armed = false; del.textContent = '삭제'; del.classList.remove('danger'); }, 2500); return; }
        p.tests.splice(p.activeTest, 1); testState.splice(p.activeTest, 1);
        p.activeTest = Math.max(0, p.activeTest - 1);
        persist(); renderTestTabs(); showTest();
      });
      box.append(el('div', { class: 'tabs-tools' }, del));
    }
  }
  function showTest() {
    const t = P().tests[P().activeTest];
    $('tin').value = t.input; $('texp').value = t.expected;
  }
  $('tin').addEventListener('input', () => { P().tests[P().activeTest].input = $('tin').value; persist(); });
  $('texp').addEventListener('input', () => { P().tests[P().activeTest].expected = $('texp').value; persist(); });
  $('clearIn').addEventListener('click', () => { $('tin').value = ''; P().tests[P().activeTest].input = ''; persist(); $('tin').focus(); });
  $('useOut').addEventListener('click', () => {
    if (lastOutput == null) { toast('먼저 실행하세요'); return; }
    $('texp').value = lastOutput; P().tests[P().activeTest].expected = lastOutput; persist(); toast('기대 출력에 저장');
  });
  for (const id of ['tin', 'texp']) $(id).addEventListener('keydown', (e) => {
    if (e.key === 'Tab' && !e.shiftKey && !e.metaKey && !e.ctrlKey) {
      e.preventDefault(); const t = e.target; t.setRangeText('\t', t.selectionStart, t.selectionEnd, 'end'); t.dispatchEvent(new Event('input'));
    }
  });

  // ---------- Compilers ----------
  async function fetchCompilers() {
    try {
      const r = await fetch(API + '/list.json', { cache: 'no-store' });
      if (!r.ok) throw new Error(r.status);
      const list = await r.json();
      compilerList = list.filter(c => ['C++', 'C', 'Java', 'Python'].includes(c.language))
        .map(c => ({ name: c.name, language: c.language, version: c.version }));
      save(LIST_KEY, compilerList);
      renderCompilers();
    } catch (e) { /* keep cached or fallback list */ }
  }
  function compilersFor(lang) {
    const L = LANGS[lang];
    if (compilerList && compilerList.length) {
      const l = compilerList.filter(c => c.language === L.wandboxLang);
      if (l.length) return l;
    }
    return L.fallback.map(n => ({ name: n, version: '' }));
  }
  function defaultCompiler(lang) {
    const list = compilersFor(lang);
    for (const re of LANGS[lang].prefer) { const c = list.find(x => re.test(x.name) && !/head/.test(x.name)); if (c) return c.name; }
    return list[0].name;
  }
  function renderCompilers() {
    const p = P();
    const sel = $('compiler');
    const list = compilersFor(p.lang);
    if (!p.compiler || !list.some(c => c.name === p.compiler)) p.compiler = defaultCompiler(p.lang);
    sel.innerHTML = '';
    for (const c of list) sel.append(el('option', { value: c.name, selected: c.name === p.compiler }, c.name));
  }
  $('compiler').addEventListener('change', () => { P().compiler = $('compiler').value; persist(); });
  $('flags').addEventListener('input', () => { P().flags = $('flags').value; persist(); });

  function renderTop() {
    const p = P();
    $('projName').textContent = p.name;
    $('lang').value = p.lang;
    $('flagsField').hidden = !LANGS[p.lang].flags;
    $('flags').value = p.flags || '';
    renderCompilers();
  }

  $('lang').addEventListener('change', () => {
    const p = P();
    const lang = $('lang').value;
    sheet('언어 변경: ' + LANGS[lang].label, (body, close) => {
      body.append(
        el('p', null, '이 문제의 언어를 바꿉니다. 코드를 새 언어의 예제 템플릿으로 바꿀지 선택하세요.'),
        el('div', { class: 'row' },
          el('button', { class: 'btn primary', type: 'button', onclick: () => {
            p.lang = lang; p.compiler = ''; p.flags = LANGS[lang].flags || '';
            p.files = TEMPLATES[lang].map(f => ({ name: f.name, code: f.code })); p.activeFile = 0; docs.clear();
            persist(); renderAll(); close();
          } }, '템플릿으로 교체'),
          el('button', { class: 'btn', type: 'button', onclick: () => {
            p.lang = lang; p.compiler = ''; p.flags = LANGS[lang].flags || ''; docs.clear();
            persist(); renderAll(); close();
          } }, '코드 유지')));
    }, () => { $('lang').value = p.lang; });
  });

  // ---------- Running ----------
  function buildRequest(stdin) {
    const p = P();
    const L = LANGS[p.lang];
    const main = p.files[0];
    let code = main.code;
    if (p.lang === 'java') {
      // 서버의 시작 파일 이름은 prog.java 이므로 public class 를 일반 class 로 바꿉니다 (줄/열 위치 유지).
      code = code.replace(/^(\s*)public(\s+(?:final\s+|abstract\s+)*class\s)/gm, (m, a, b) => a + '      ' + b);
    }
    const req = { compiler: p.compiler || defaultCompiler(p.lang), code, stdin: stdin || '', save: false };
    const others = p.files.slice(1);
    if (others.length) req.codes = others.map(f => ({ file: f.name, code: f.code }));
    if (L.flags !== null) {
      const raw = (p.flags || '').split(/\s+/).filter(Boolean);
      for (const f of others) if (L.srcExt && L.srcExt.test(f.name)) raw.push(f.name);
      if (raw.length) req['compiler-option-raw'] = raw.join('\n');
    }
    return req;
  }

  async function execute(stdin, signal) {
    const req = buildRequest(stdin);
    const t0 = performance.now();
    const r = await fetch(API + '/compile.json', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(req), signal,
    });
    const ms = Math.round(performance.now() - t0);
    if (!r.ok) {
      const txt = await r.text().catch(() => '');
      throw new Error('서버 오류 ' + r.status + (txt ? ': ' + txt.slice(0, 300) : ''));
    }
    const j = await r.json();
    j._ms = ms;
    return j;
  }

  function normalize(s) {
    return (s || '').replace(/\r\n?/g, '\n').split('\n').map(l => l.replace(/[ \t]+$/, '')).join('\n').replace(/\n+$/, '');
  }
  function classify(res, expected) {
    const compileFailed = res.status !== '0' && !res.program_output && !res.program_error && (res.compiler_error || '').length > 0 && /error/i.test(res.compiler_error);
    if (compileFailed) return { kind: 'ce', label: '컴파일 에러', cls: 'fail' };
    if (res.signal) return { kind: 're', label: '런타임 에러 (' + res.signal + ')', cls: 'fail' };
    if (res.status && res.status !== '0') return { kind: 're', label: '런타임 에러 (종료 코드 ' + res.status + ')', cls: 'fail' };
    if (expected == null || normalize(expected) === '') return { kind: 'ok', label: '실행 완료', cls: 'info' };
    return normalize(res.program_output) === normalize(expected)
      ? { kind: 'ac', label: '정답', cls: 'pass' }
      : { kind: 'wa', label: '오답', cls: 'fail' };
  }

  const out = $('out');
  function mapNames(text) {
    const p = P();
    const L = LANGS[p.lang];
    return (text || '').split(L.mainName).join(p.files[0].name);
  }
  // Turn "file:line:" / File "x", line N into clickable links
  function renderMessage(text, cls) {
    const frag = document.createDocumentFragment();
    const p = P();
    const names = p.files.map(f => f.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
    const re = new RegExp('((?:' + names + '):(\\d+)(?::\\d+)?|File "(?:' + names + ')", line (\\d+))', 'g');
    let last = 0, m;
    while ((m = re.exec(text))) {
      if (m.index > last) frag.append(span(text.slice(last, m.index), cls));
      const line = parseInt(m[2] || m[3], 10);
      const fname = (m[1].match(/^File "([^"]+)"/) || m[1].match(/^([^:]+):/))[1];
      const idx = p.files.findIndex(f => f.name === fname);
      const a = el('a', { class: 'loc', role: 'button', tabindex: '0' }, m[0]);
      a.addEventListener('click', () => idx >= 0 && jumpTo(idx, line));
      frag.append(a);
      last = m.index + m[0].length;
    }
    if (last < text.length) frag.append(span(text.slice(last), cls));
    return frag;
  }
  function span(t, cls) { return cls ? el('span', { class: cls }, t) : document.createTextNode(t); }
  function sec(title) { return el('span', { class: 'sec' }, title); }

  function firstDiff(exp, got) {
    const a = normalize(exp).split('\n'), b = normalize(got).split('\n');
    const n = Math.max(a.length, b.length);
    for (let i = 0; i < n; i++) if (a[i] !== b[i]) return { line: i + 1, exp: a[i], got: b[i] };
    return null;
  }

  function showResult(res, expected, v) {
    out.innerHTML = '';
    const cerr = mapNames(res.compiler_error);
    const cout = mapNames(res.compiler_output);
    if (cerr || cout) {
      out.append(sec(v.kind === 'ce' ? '컴파일 에러' : '컴파일러 메시지'));
      out.append(renderMessage(cout + cerr, v.kind === 'ce' ? 'e' : 'w'));
    }
    if (v.kind !== 'ce') {
      out.append(sec('출력 (stdout)'));
      out.append(document.createTextNode(res.program_output || ''));
      if (!res.program_output) out.append(span('(출력 없음)', 'w'));
      if (res.program_error) { out.append(sec('에러 출력 (stderr)')); out.append(renderMessage(mapNames(res.program_error), 'e')); }
      if (v.kind === 'wa') {
        const d = firstDiff(expected, res.program_output);
        if (d) {
          out.append(sec(d.line + '번째 줄이 다릅니다'));
          out.append(span('기대: ' + (d.exp === undefined ? '(줄 없음)' : JSON.stringify(d.exp)) + '\n', 'diff-exp'));
          out.append(span('결과: ' + (d.got === undefined ? '(줄 없음)' : JSON.stringify(d.got)), 'diff-got'));
        }
      }
    }
  }

  function setVerdict(cls, label, meta, busy) {
    const v = $('verdict');
    v.innerHTML = '';
    v.append(el('span', { class: 'pill ' + cls }, busy ? el('span', { class: 'spin' }) : null, label));
    if (meta) v.append(el('span', { class: 'meta' }, meta));
  }

  let running = null;
  function setBusy(b) {
    $('runBtn').disabled = b; $('runAllBtn').disabled = b;
  }

  async function runCurrent() {
    if (running) return;
    const p = P();
    const i = p.activeTest;
    const t = p.tests[i];
    running = new AbortController();
    setBusy(true);
    testState[i] = 'run'; renderTestTabs();
    $('summary').innerHTML = '';
    setVerdict('warn', '컴파일·실행 중', p.compiler, true);
    const timer = setTimeout(() => running && running.abort(), 60000);
    try {
      const res = await execute(t.input, running.signal);
      const v = classify(res, t.expected);
      lastOutput = res.program_output || '';
      testState[i] = v.cls === 'pass' ? 'pass' : v.cls === 'fail' ? 'fail' : undefined;
      setVerdict(v.cls, v.label, '테스트 ' + (i + 1) + ' · 왕복 ' + res._ms + ' ms (네트워크 포함)');
      showResult(res, t.expected, v);
    } catch (e) {
      testState[i] = undefined;
      setVerdict('fail', '요청 실패', '');
      out.textContent = e.name === 'AbortError'
        ? '60초 안에 응답이 없어 중단했습니다. 무한 루프가 없는지 확인하고 다시 실행하세요.'
        : '서버에 연결하지 못했습니다. 인터넷 연결을 확인하세요.\n\n' + (e.message || e);
    } finally {
      clearTimeout(timer); running = null; setBusy(false); renderTestTabs();
    }
  }

  async function runAll() {
    if (running) return;
    const p = P();
    running = new AbortController();
    setBusy(true);
    const n = p.tests.length;
    const results = new Array(n);
    p.tests.forEach((_, i) => testState[i] = 'run');
    renderTestTabs();
    const sum = $('summary');
    sum.innerHTML = '';
    out.innerHTML = '';
    let done = 0, pass = 0, firstFail = -1;
    setVerdict('warn', '전체 테스트 실행 중', '0 / ' + n, true);
    const timer = setTimeout(() => running && running.abort(), 60000 + n * 15000);
    // 서버 부담을 줄이기 위해 동시에 2개씩 실행
    let next = 0;
    async function worker() {
      while (next < n) {
        const i = next++;
        const t = p.tests[i];
        try {
          const res = await execute(t.input, running.signal);
          const v = classify(res, t.expected);
          results[i] = { res, v };
          testState[i] = v.cls === 'pass' ? 'pass' : v.cls === 'fail' ? 'fail' : undefined;
          if (v.kind === 'ac') pass++;
          else if (firstFail < 0 || i < firstFail) firstFail = i;
          if (v.kind === 'ce') { next = n; for (let k = 0; k < n; k++) if (!results[k] && k !== i) { results[k] = { res, v }; testState[k] = 'fail'; } }
        } catch (e) {
          results[i] = { err: e };
          testState[i] = undefined;
          if (firstFail < 0 || i < firstFail) firstFail = i;
        }
        done++;
        renderTestTabs();
        setVerdict('warn', '전체 테스트 실행 중', done + ' / ' + n, true);
      }
    }
    try {
      await Promise.all([worker(), worker()]);
    } finally {
      clearTimeout(timer); running = null; setBusy(false);
    }
    const ce = results.find(r => r && r.v && r.v.kind === 'ce');
    if (ce) {
      setVerdict('fail', '컴파일 에러', '');
      showResult(ce.res, null, ce.v);
    } else {
      const graded = results.filter(r => r && r.v && r.v.kind !== 'ok').length;
      const allOk = pass === n;
      setVerdict(allOk ? 'pass' : (graded ? 'fail' : 'info'), allOk ? '모두 정답' : pass + ' / ' + n + ' 정답', '');
      results.forEach((r, i) => {
        const label = r && r.v ? r.v.label : '요청 실패';
        const cls = r && r.v ? r.v.cls : 'fail';
        const chip = el('button', { class: 'chip ' + cls, type: 'button' }, '#' + (i + 1) + ' ' + label);
        chip.addEventListener('click', () => {
          p.activeTest = i; renderTestTabs(); showTest();
          if (r && r.res) { lastOutput = r.res.program_output || ''; showResult(r.res, p.tests[i].expected, r.v); }
          else out.textContent = '요청 실패: ' + (r && r.err ? r.err.message : '');
        });
        sum.append(chip);
      });
      const show = firstFail >= 0 ? firstFail : p.activeTest;
      const r = results[show];
      p.activeTest = show; showTest();
      if (r && r.res) { lastOutput = r.res.program_output || ''; showResult(r.res, p.tests[show].expected, r.v); }
      else if (r && r.err) out.textContent = '요청 실패: ' + (r.err.name === 'AbortError' ? '시간 초과' : r.err.message);
    }
    renderTestTabs();
  }

  $('runBtn').addEventListener('click', runCurrent);
  $('runAllBtn').addEventListener('click', runAll);
  document.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') { e.preventDefault(); e.shiftKey ? runAll() : runCurrent(); }
    else if ((e.metaKey || e.ctrlKey) && (e.key === 's' || e.key === 'S')) { e.preventDefault(); save(STORE_KEY, db); toast('저장됨'); }
  });

  // ---------- Sheets ----------
  function sheet(title, build, onCancel) {
    const bg = el('div', { class: 'sheet-bg' });
    const box = el('div', { class: 'sheet', role: 'dialog', 'aria-modal': 'true', 'aria-label': title });
    const close = () => { bg.remove(); document.removeEventListener('keydown', esc); };
    const esc = (e) => { if (e.key === 'Escape') { close(); onCancel && onCancel(); } };
    bg.addEventListener('click', (e) => { if (e.target === bg) { close(); onCancel && onCancel(); } });
    document.addEventListener('keydown', esc);
    const head = el('div', { class: 'row' }, el('h2', null, title),
      el('button', { class: 'btn small', type: 'button', style: 'flex:0 0 auto', onclick: () => { close(); onCancel && onCancel(); } }, '닫기'));
    box.append(head);
    build(box, close);
    bg.append(box);
    document.body.append(bg);
  }

  $('projBtn').addEventListener('click', () => {
    sheet('문제 목록', (body, close) => {
      const list = el('div', { class: 'list' });
      const items = Object.values(db.projects).sort((a, b) => b.updated - a.updated);
      for (const pr of items) {
        list.append(el('button', { class: 'btn' + (pr.id === db.current ? ' cur' : ''), type: 'button', onclick: () => {
          db.current = pr.id; testState.length = 0; lastOutput = null; save(STORE_KEY, db); renderAll(); close();
        } }, pr.name + '  ·  ' + LANGS[pr.lang].label));
      }
      const nameIn = el('input', { type: 'text', id: 'newProjName', placeholder: '새 문제 이름', autocorrect: 'off' });
      const langSel = el('select', { id: 'newProjLang' }, ...Object.keys(LANGS).map(k => el('option', { value: k, selected: k === P().lang }, LANGS[k].label)));
      const cur = P();
      const renameIn = el('input', { type: 'text', id: 'renameProj', value: cur.name, autocorrect: 'off' });
      const del = el('button', { class: 'btn danger', type: 'button' }, '이 문제 삭제');
      let armed = false;
      del.addEventListener('click', () => {
        if (!armed) { armed = true; del.textContent = '한 번 더 눌러 삭제'; return; }
        delete db.projects[cur.id];
        if (!Object.keys(db.projects).length) { const np = newProject('예제 문제', 'cpp'); db.projects[np.id] = np; }
        db.current = Object.keys(db.projects)[0]; testState.length = 0;
        save(STORE_KEY, db); renderAll(); close();
      });
      body.append(list,
        el('h2', null, '새 문제'),
        el('div', { class: 'row' }, nameIn, langSel,
          el('button', { class: 'btn primary', type: 'button', onclick: () => {
            const np = newProject(nameIn.value.trim() || ('문제 ' + (Object.keys(db.projects).length + 1)), langSel.value);
            db.projects[np.id] = np; db.current = np.id; testState.length = 0; lastOutput = null;
            save(STORE_KEY, db); renderAll(); close();
          } }, '만들기')),
        el('h2', null, '현재 문제: ' + cur.name),
        el('div', { class: 'row' }, renameIn,
          el('button', { class: 'btn', type: 'button', onclick: () => {
            cur.name = renameIn.value.trim() || cur.name; save(STORE_KEY, db); renderTop(); close();
          } }, '이름 변경')),
        el('div', { class: 'row' },
          el('button', { class: 'btn', type: 'button', onclick: () => {
            const cp = JSON.parse(JSON.stringify(cur)); cp.id = uid(); cp.name = cur.name + ' 사본'; cp.updated = Date.now();
            db.projects[cp.id] = cp; db.current = cp.id; save(STORE_KEY, db); renderAll(); close();
          } }, '복제'),
          el('button', { class: 'btn', type: 'button', onclick: () => {
            const all = cur.files.map(f => '// ===== ' + f.name + ' =====\n' + f.code).join('\n');
            copyText(all, '모든 파일을 복사했습니다');
          } }, '전체 코드 복사'),
          del));
    });
  });

  $('settingsBtn').addEventListener('click', () => {
    sheet('설정', (body, close) => {
      const theme = el('select', { id: 'prefTheme' },
        el('option', { value: 'system', selected: prefs.theme === 'system' }, '시스템'),
        el('option', { value: 'light', selected: prefs.theme === 'light' }, '라이트'),
        el('option', { value: 'dark', selected: prefs.theme === 'dark' }, '다크'));
      theme.addEventListener('change', () => { prefs.theme = theme.value; save(PREF_KEY, prefs); applyPrefs(); });
      const fs = el('select', { id: 'prefFont' }, ...[12, 13, 14, 15, 16, 17, 18, 20, 22].map(s => el('option', { value: s, selected: s === prefs.fontSize }, s + 'px')));
      fs.addEventListener('change', () => { prefs.fontSize = +fs.value; save(PREF_KEY, prefs); applyPrefs(); });
      const pl = el('input', { type: 'checkbox', id: 'prefPlain', checked: prefs.plain });
      pl.addEventListener('change', () => { prefs.plain = pl.checked; save(PREF_KEY, prefs); setupEditor(); showFile(); });
      const ks = el('input', { type: 'checkbox', id: 'prefKeys', checked: prefs.keys });
      ks.addEventListener('change', () => { prefs.keys = ks.checked; save(PREF_KEY, prefs); renderKeys(); });
      const reset = el('button', { class: 'btn', type: 'button' }, '현재 문제 코드를 템플릿으로 초기화');
      let armed = false;
      reset.addEventListener('click', () => {
        if (!armed) { armed = true; reset.textContent = '한 번 더 누르면 초기화'; reset.classList.add('danger'); return; }
        const p = P(); p.files = TEMPLATES[p.lang].map(f => ({ name: f.name, code: f.code })); p.activeFile = 0; docs.clear();
        persist(); renderAll(); close();
      });
      body.append(
        el('div', { class: 'row' }, el('label', { for: 'prefTheme' }, '테마'), theme),
        el('div', { class: 'row' }, el('label', { for: 'prefFont' }, '코드 글자 크기'), fs),
        el('div', { class: 'row' }, el('label', { for: 'prefKeys' }, ks, ' 기호 키 줄 표시')),
        el('div', { class: 'row' }, el('label', { for: 'prefPlain' }, pl, ' 단순 편집기 사용 (입력이 이상할 때)')),
        reset,
        el('p', null, '코드는 Wandbox 공개 컴파일 서버(wandbox.org)에서 실행됩니다. 표시되는 시간은 네트워크를 포함한 왕복 시간이라 실제 실행 시간과 다릅니다. 데이터는 이 기기의 브라우저에만 저장됩니다.'));
    });
  });

  function applyPrefs() {
    const r = document.documentElement;
    if (prefs.theme === 'system') r.removeAttribute('data-theme'); else r.setAttribute('data-theme', prefs.theme);
    r.style.setProperty('--code-size', prefs.fontSize + 'px');
    const dark = prefs.theme === 'dark' || (prefs.theme === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);
    const meta = document.querySelector('meta[name=theme-color]'); if (meta) meta.content = dark ? '#14161c' : '#f3f4f7';
    if (cm) cm.refresh();
  }

  function renderAll() {
    renderTop(); renderFileTabs(); showFile(); renderTestTabs(); showTest();
    out.innerHTML = ''; $('summary').innerHTML = '';
    setVerdict('info', '대기', '실행 버튼을 누르면 서버에서 컴파일 후 실행합니다.');
  }

  // ---------- Boot ----------
  applyPrefs();
  setupEditor();
  renderKeys();
  renderAll();
  fetchCompilers();
  window.__proide = { buildRequest, normalize, classify };
})();
