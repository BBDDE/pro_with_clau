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

  const prefs = Object.assign({ theme: 'system', fontSize: 15, plain: false, keys: true, complete: true, words: true, lint: true }, load(PREF_KEY, {}));
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
  let completer = null;
  let suppress = false;
  const docs = new Map(); // key: project.id + '/' + index -> CodeMirror.Doc

  function hasCM() { return typeof window.CodeMirror === 'function'; }

  function setupEditor() {
    if (cm) { cm.getWrapperElement().remove(); cm = null; }
    completer = null;
    docs.clear();
    if (prefs.plain || !hasCM()) {
      plain.hidden = false;
      return;
    }
    plain.hidden = true;
    cm = CodeMirror(wrap, {
      lineNumbers: true, gutters: ['CodeMirror-linenumbers', 'lint-gutter', 'CodeMirror-foldgutter'], indentUnit: 4,
      foldGutter: CodeMirror.fold ? { rangeFinder: foldRange } : false,
      foldOptions: { widget: foldWidget, rangeFinder: foldRange, minFoldSize: 1 }, tabSize: 4, indentWithTabs: false,
      matchBrackets: true, autoCloseBrackets: true, styleActiveLine: true,
      inputStyle: 'contenteditable', spellcheck: false, autocorrect: false, autocapitalize: false,
      extraKeys: {
        'Tab': (c) => c.somethingSelected() ? c.indentSelection('add') : c.replaceSelection('    ', 'end'),
        'Shift-Tab': (c) => c.indentSelection('subtract'),
        'Ctrl-/': 'toggleComment', 'Cmd-/': 'toggleComment',
        'Ctrl-Q': (c) => c.foldCode(c.getCursor()), 'Ctrl-Alt-[': () => foldTop(), 'Ctrl-Alt-]': () => unfoldAll(),
        'Ctrl-Space': () => completer && completer.show(), 'Ctrl-J': () => completer && completer.show(),
        'Ctrl-Enter': () => runCurrent(), 'Cmd-Enter': () => runCurrent(),
        'Shift-Ctrl-Enter': () => runAll(), 'Shift-Cmd-Enter': () => runAll(),
        'Ctrl-S': () => { save(STORE_KEY, db); toast('저장됨'); }, 'Cmd-S': () => { save(STORE_KEY, db); toast('저장됨'); },
      },
    });
    if (window.ProComplete && cm.showHint) {
      completer = ProComplete.attach(cm, {
        getFiles: () => P().files,
        getCurrentIndex: () => P().activeFile,
        isEnabled: () => prefs.complete,
        wordsEnabled: () => prefs.words,
        isCLike: () => (P().lang === 'cpp' || P().lang === 'c') && !/\.(txt|md)$/i.test(P().files[P().activeFile].name),
      });
    }
    watchComposition(cm);
    cm.on('change', () => {
      if (suppress) return;
      const p = P();
      p.files[p.activeFile].code = cm.getValue();
      persist();
      editVersion++; scheduleLint();
      saveFolds();
      schedulePins();
    });
    cm.on('fold', saveFolds);
    cm.on('unfold', saveFolds);
    cm.on('gutterClick', (c, line, gutter) => {
      if (gutter !== 'lint-gutter') return;
      const f = P().files[P().activeFile];
      const d = (diags[f.name] || []).find(x => x.line - 1 === line);
      if (d) toast(d.line + '줄: ' + d.msg);
    });
  }

  function showFile() {
    const p = P();
    const f = p.files[p.activeFile];
    if (!f) return;
    if (cm) {
      const key = p.id + '/' + p.activeFile + '/' + f.name;
      let d = docs.get(key);
      let fresh = false;
      if (!d || d.getValue() !== f.code) { d = CodeMirror.Doc(f.code, modeFor(f.name, p.lang)); docs.set(key, d); fresh = true; }
      suppress = true; cm.swapDoc(d); suppress = false;
      cm.setOption('mode', modeFor(f.name, p.lang));
      if (fresh && f.folds && f.folds.length) restoreFolds(f.folds);
      loadPins(fresh);
      cm.setOption('lineWrapping', /\.(txt|md)$/i.test(f.name));
      cm.refresh();
      applyDiags();
      lintCursor = 0; renderLintBar();
    } else {
      plain.value = f.code;
    }
  }

  // ---------- 입력 중 보호 ----------
  // 안드로이드 키보드는 단어를 확정하기 전까지 '조합 중' 상태로 둡니다. 그 사이 편집기 줄을 다시 그리면
  // 조합 중이던 글자가 지워지거나 겹치므로, 화면을 바꾸는 작업은 입력이 멈출 때까지 미룹니다.
  let composing = false, lastInputAt = 0;
  function editorBusy() {
    const inp = cm && cm.display && cm.display.input;
    const idleFor = Date.now() - lastInputAt;
    // 조합 종료 신호를 놓쳐도 20초 동안 입력이 없으면 끝난 것으로 봄 (글자 보호가 우선)
    return ((composing || !!(inp && inp.composing)) && idleFor < 20000) || idleFor < 800;
  }
  function whenIdle(fn) {
    if (!editorBusy()) { fn(); return; }
    setTimeout(() => whenIdle(fn), 300);
  }
  function watchComposition(c) {
    const field = c.getInputField();
    const wrapEl = c.getWrapperElement();
    const touch = () => { lastInputAt = Date.now(); };
    field.addEventListener('compositionstart', () => { composing = true; touch(); });
    field.addEventListener('compositionupdate', touch);
    field.addEventListener('compositionend', () => { composing = false; touch(); });
    // 잠깐 포커스가 빠졌다 바로 돌아오는 경우는 무시하고, 정말 다른 곳으로 갔을 때만 조합이 끝난 것으로 봄
    field.addEventListener('focusout', () => { setTimeout(() => { if (document.activeElement !== field) composing = false; }, 150); });
    wrapEl.addEventListener('keydown', touch, true);
    wrapEl.addEventListener('input', touch, true);
    wrapEl.addEventListener('beforeinput', touch, true);
    c.on('change', touch);
  }

  // ---------- 줄 고정 ----------
  // 파일마다 고정한 줄 범위를 줄 핸들로 들고 있어서, 위에서 줄을 넣거나 지워도 같은 줄을 따라갑니다.
  const pinMap = new Map(); // doc -> [{ a: lineHandle, b: lineHandle }]
  let pinCM = null, pinTimer = null, pinLines = []; // pinLines: 고정 칸의 각 줄 -> 원래 줄 번호(0부터), 구분선은 -1
  let pinClassed = [];
  function pinRanges(doc) {
    const list = pinMap.get(doc) || [];
    const out = [];
    for (const r of list) {
      const a = doc.getLineNumber(r.a), b = doc.getLineNumber(r.b);
      if (a == null || b == null) continue;
      out.push({ from: Math.min(a, b), to: Math.max(a, b) });
    }
    out.sort((x, y) => x.from - y.from);
    const merged = [];
    for (const r of out) { const last = merged[merged.length - 1]; if (last && r.from <= last.to) last.to = Math.max(last.to, r.to); else merged.push({ ...r }); }
    return merged;
  }
  function setPinRanges(doc, ranges) {
    pinMap.set(doc, ranges.map(r => ({ a: doc.getLineHandle(r.from), b: doc.getLineHandle(r.to) })));
  }
  function loadPins(fresh) {
    if (!cm) return;
    const doc = cm.getDoc();
    const f = P().files[P().activeFile];
    if (fresh || !pinMap.has(doc)) {
      const n = doc.lineCount();
      setPinRanges(doc, (f.pins || []).filter(r => r[0] < n).map(r => ({ from: r[0], to: Math.min(r[1], n - 1) })));
    }
    renderPins();
  }
  function savePins() {
    if (!cm) return;
    const f = P().files[P().activeFile];
    const pins = pinRanges(cm.getDoc()).map(r => [r.from, r.to]);
    if (JSON.stringify(f.pins || []) !== JSON.stringify(pins)) { f.pins = pins; persist(); }
  }
  function togglePin() {
    if (!cm) { toast('단순 편집기에서는 줄 고정을 쓸 수 없습니다'); return; }
    const doc = cm.getDoc();
    const sel = doc.listSelections()[0];
    let from = Math.min(sel.anchor.line, sel.head.line), to = Math.max(sel.anchor.line, sel.head.line);
    if (to > from && Math.max(sel.anchor.line, sel.head.line) === to && (sel.anchor.line > sel.head.line ? sel.anchor.ch : sel.head.ch) === 0) to--; // 다음 줄 맨 앞까지 선택한 경우
    const ranges = pinRanges(doc);
    const hit = ranges.findIndex(r => from >= r.from && to <= r.to);
    if (hit >= 0 && from === to) {
      // 커서만 있는 줄이 고정 범위 안이면 그 범위를 해제
      ranges.splice(hit, 1);
      toast('고정을 해제했습니다');
    } else {
      // 선택이 없으면 커서가 있는 블록의 첫 줄(함수·struct 머리)을 고정
      ranges.push({ from, to });
      toast(from === to ? (from + 1) + '줄을 고정했습니다' : (from + 1) + '~' + (to + 1) + '줄을 고정했습니다');
    }
    setPinRanges(doc, ranges);
    renderPins(); savePins();
    cm.focus();
  }
  function schedulePins() { clearTimeout(pinTimer); pinTimer = setTimeout(() => { renderPins(); savePins(); }, 120); }
  let pinClassKey = '', pinClassDoc = null, pinTextKey = '';
  // 본문 편집기의 줄 표시(왼쪽 초록 선)는 고정 범위가 바뀔 때만, 그리고 입력이 멈췄을 때만 바꿉니다.
  // (입력 중에 줄을 다시 그리면 안드로이드 키보드가 입력 중이던 글자를 잃어버림)
  function updatePinClasses(doc, ranges) {
    const key = ranges.map(r => r.from + '-' + r.to).join(',');
    if (doc === pinClassDoc && key === pinClassKey) return;
    whenIdle(() => {
      if (!cm || cm.getDoc() !== doc) return;
      const now = pinRanges(doc);
      const nowKey = now.map(r => r.from + '-' + r.to).join(',');
      if (doc === pinClassDoc && nowKey === pinClassKey) return;
      cm.operation(() => {
        for (const h of pinClassed) { try { h.doc.removeLineClass(h.handle, 'wrap', 'pinned-line'); } catch (e) { /* 지워진 줄 */ } }
        pinClassed = [];
        for (const r of now) for (let l = r.from; l <= r.to; l++) pinClassed.push({ doc, handle: doc.addLineClass(l, 'wrap', 'pinned-line') });
      });
      pinClassDoc = doc; pinClassKey = nowKey;
    });
  }
  function renderPins() {
    const box = $('pins');
    if (!cm) { box.hidden = true; return; }
    const doc = cm.getDoc();
    const ranges = pinRanges(doc);
    updatePinClasses(doc, ranges);
    if (!ranges.length) {
      if (!box.hidden) { box.hidden = true; pinTextKey = ''; refreshEditorSoon(); }
      return;
    }
    const lines = [];
    pinLines = [];
    ranges.forEach((r, i) => {
      if (i > 0) { lines.push('⋯'); pinLines.push(-1); }
      for (let l = r.from; l <= r.to; l++) { lines.push(doc.getLine(l)); pinLines.push(l); }
    });
    const textKey = pinLines.join(',') + '\u0000' + lines.join('\n') + '\u0000' + cm.getOption('mode');
    if (!box.hidden && textKey === pinTextKey) return; // 바뀐 것 없음
    pinTextKey = textKey;
    const wasHidden = box.hidden;
    box.hidden = false;
    if (!pinCM) {
      pinCM = CodeMirror($('pinsBody'), {
        readOnly: 'nocursor', lineNumbers: true, viewportMargin: Infinity, tabSize: 4,
        lineNumberFormatter: (n) => { const l = pinLines[n - 1]; return l == null || l < 0 ? '' : String(l + 1); },
      });
      $('pinsBody').addEventListener('click', (e) => {
        const pos = pinCM.coordsChar({ left: e.clientX, top: e.clientY }, 'window');
        const l = pinLines[pos.line];
        if (l != null && l >= 0) jumpTo(P().activeFile, l + 1);
      });
    }
    pinCM.setOption('mode', cm.getOption('mode'));
    const nums = pinLines.slice();
    pinCM.setOption('lineNumberFormatter', (n) => { const l = nums[n - 1]; return l == null || l < 0 ? '' : String(l + 1); }); // 줄 번호가 밀려도 새로 그림
    const text = lines.join('\n');
    if (pinCM.getValue() !== text) pinCM.setValue(text);
    pinCM.operation(() => pinLines.forEach((l, i) => { if (l < 0) pinCM.addLineClass(i, 'text', 'pin-sep'); }));
    pinCM.refresh();
    if (wasHidden) refreshEditorSoon();
  }
  $('pinsClear').addEventListener('click', () => { if (!cm) return; setPinRanges(cm.getDoc(), []); renderPins(); savePins(); toast('고정을 모두 해제했습니다'); });

  // ---------- 함수로 이동 · 돌아가기 ----------
  const posHistory = [];
  function rememberPos() {
    if (!cm) return;
    const p = P();
    const c = cm.getCursor();
    const last = posHistory[posHistory.length - 1];
    if (last && last.file === p.activeFile && last.line === c.line) return;
    posHistory.push({ project: p.id, file: p.activeFile, line: c.line, ch: c.ch });
    if (posHistory.length > 50) posHistory.shift();
  }
  function goBack() {
    const p = P();
    while (posHistory.length) {
      const h = posHistory.pop();
      if (h.project !== p.id || h.file >= p.files.length) continue;
      if (h.file !== p.activeFile) { p.activeFile = h.file; renderFileTabs(); showFile(); }
      if (cm) { cm.setCursor({ line: h.line, ch: h.ch }); cm.scrollIntoView({ line: h.line, ch: h.ch }, 80); cm.focus(); }
      return;
    }
    toast('돌아갈 위치가 없습니다');
  }
  function outlineItems() {
    const items = [];
    if (!cm || !CodeMirror.fold) return items;
    const n = cm.lineCount();
    const scan = (from, to, depth) => {
      for (let l = from; l <= to && l < n; l++) {
        const text = cm.getLine(l);
        if (/^\s*(\/\/|\/\*|#)/.test(text) || !text.trim()) continue;
        const r = foldRange(cm, CodeMirror.Pos(l, 0));
        if (r && r.to.line > r.from.line) {
          const head = text.replace(/\{.*$/, '').trim() || text.trim();
          if (!/^(if|else|for|while|do|switch|try|case)\b/.test(head)) items.push({ line: l, text: head, depth });
          if (depth === 0 && /\b(struct|class|union)\b/.test(head)) scan(l + 1, r.to.line - 1, 1);
          l = r.to.line;
        }
      }
    };
    scan(0, n - 1, 0);
    return items;
  }
  function showOutline() {
    if (!cm) { toast('단순 편집기에서는 쓸 수 없습니다'); return; }
    const p = P();
    const items = outlineItems();
    sheet('이동: ' + p.files[p.activeFile].name, (body, close) => {
      if (!items.length) { body.append(el('p', null, '이 파일에서 함수나 struct를 찾지 못했습니다.')); return; }
      const list = el('div', { class: 'list' });
      const curLine = cm.getCursor().line;
      for (const it of items) {
        list.append(el('button', { class: 'btn outline-item' + (it.depth ? ' child' : ''), type: 'button', onclick: () => { close(); jumpTo(p.activeFile, it.line + 1); } },
          el('span', { class: 'ol-ln' }, String(it.line + 1)), el('span', { class: 'ol-tx' }, it.text)));
      }
      body.append(list);
      body.append(el('p', null, '이동한 뒤 ↩ 버튼을 누르면 원래 쓰던 위치로 돌아옵니다. 현재 커서: ' + (curLine + 1) + '줄'));
    });
  }

  // ---------- 코드 접기 ----------
  function foldRange(c, start) {
    const F = CodeMirror.fold;
    if (/python/.test(c.getOption('mode'))) return F.indent(c, start);
    return F.auto(c, start);
  }
  function foldWidget(from, to) {
    const w = document.createElement('span');
    w.className = 'fold-widget';
    w.append('⋯');
    const n = to.line - from.line - 1;
    if (n > 0) { const s = document.createElement('span'); s.className = 'fw-n'; s.textContent = n + '줄'; w.append(s); }
    w.title = '눌러서 펼치기';
    return w;
  }
  let foldBusy = false;
  function currentFolds() {
    if (!cm) return [];
    const lines = cm.getAllMarks().filter(m => m.__isFold).map(m => { const r = m.find(); return r ? r.from.line : -1; }).filter(l => l >= 0);
    return [...new Set(lines)].sort((a, b) => a - b);
  }
  function saveFolds() {
    if (!cm || suppress || foldBusy) return;
    const p = P(); const f = p.files[p.activeFile];
    if (!f) return;
    const folds = currentFolds();
    if ((f.folds || []).join() !== folds.join()) { f.folds = folds; persist(); }
  }
  function restoreFolds(lines) {
    foldBusy = true;
    try { for (const l of lines.slice().sort((a, b) => b - a)) if (l < cm.lineCount()) cm.foldCode(CodeMirror.Pos(l, 0), null, 'fold'); }
    finally { foldBusy = false; }
  }
  // 바깥쪽 블록(함수, struct)만 접기
  function foldTop() {
    if (!cm) return;
    foldBusy = true;
    try {
      const n = cm.lineCount();
      for (let l = 0; l < n; l++) {
        const r = foldRange(cm, CodeMirror.Pos(l, 0));
        if (r && r.to.line > r.from.line) {
          if (!/^\s*(\/\*|\/\/)/.test(cm.getLine(l))) cm.foldCode(CodeMirror.Pos(l, 0), null, 'fold');
          l = r.to.line;
        }
      }
    } finally { foldBusy = false; }
    saveFolds();
  }
  function unfoldAll() {
    if (!cm) return;
    foldBusy = true;
    try { cm.operation(() => { for (let l = cm.firstLine(); l <= cm.lastLine(); l++) cm.foldCode(CodeMirror.Pos(l, 0), null, 'unfold'); }); }
    finally { foldBusy = false; }
    saveFolds();
  }

  function modeFor(name, lang) {
    if (/\.py$/i.test(name)) return 'text/x-python';
    if (/\.java$/i.test(name)) return 'text/x-java';
    if (/\.(c|h)$/i.test(name)) return lang === 'cpp' ? 'text/x-c++src' : 'text/x-csrc';
    if (/\.(cpp|cc|cxx|hpp|hh|hxx)$/i.test(name)) return 'text/x-c++src';
    if (/\.txt$/i.test(name)) return 'text/plain';
    return LANGS[lang].mode;
  }

  plain.addEventListener('input', () => { const p = P(); p.files[p.activeFile].code = plain.value; persist(); editVersion++; scheduleLint(); });
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
    rememberPos();
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
    ['목록', null, 'wide', 0, () => { if (completer) completer.show(); }], ['sep'],
    ['접기/펴기', null, 'wide', 0, () => { if (cm) { cm.foldCode(cm.getCursor()); cm.focus(); } }],
    ['모두 접기', null, 'wide', 0, () => foldTop()],
    ['모두 펴기', null, 'wide', 0, () => unfoldAll()], ['sep'],
    ['고정', null, 'wide', 0, () => togglePin()],
    ['이동', null, 'wide', 0, () => showOutline()],
    ['↩ 돌아가기', null, 'wide', 0, () => goBack()],
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
      el('button', { class: 'btn small', type: 'button', title: '이동하기 전 위치로 돌아가기', onclick: goBack }, '↩'),
      el('button', { class: 'btn small', type: 'button', title: '함수·struct로 바로 이동', onclick: showOutline }, '이동'),
      el('button', { class: 'btn small', type: 'button', title: '선택한 줄(또는 커서 줄)을 위에 고정', onclick: togglePin }, '고정'),
      el('button', { class: 'btn small', type: 'button', title: '코드만 크게 보기', onclick: () => setFocus(!isFocus()) }, isFocus() ? '작게' : '⛶ 크게'),
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
    $('fbName').textContent = p.name;
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

  // 서버가 잠깐 응답하지 않거나 연결이 끊기면 최대 3번까지 자동으로 다시 시도합니다.
  const sleep = (ms, signal) => new Promise((res, rej) => {
    const t = setTimeout(res, ms);
    if (signal) signal.addEventListener('abort', () => { clearTimeout(t); rej(new DOMException('aborted', 'AbortError')); }, { once: true });
  });
  async function postCompile(req, signal, onRetry) {
    const body = JSON.stringify(req);
    let lastErr = null;
    for (let attempt = 1; attempt <= 3; attempt++) {
      if (attempt > 1) { onRetry && onRetry(attempt); await sleep(1200 * (attempt - 1), signal); }
      try {
        const r = await fetch(API + '/compile.json', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body, signal });
        if (r.ok) {
          try { return await r.json(); }
          catch (e) { lastErr = Object.assign(new Error('응답을 읽지 못했습니다'), { kind: 'server' }); continue; }
        }
        const txt = await r.text().catch(() => '');
        lastErr = Object.assign(new Error('서버 오류 ' + r.status + (txt ? ': ' + txt.slice(0, 200) : '')), { kind: 'server', status: r.status });
        if (r.status >= 400 && r.status < 500 && r.status !== 408 && r.status !== 429) break; // 요청 자체 문제: 다시 해도 같음
      } catch (e) {
        if (e.name === 'AbortError') throw e;
        lastErr = Object.assign(new Error(e.message || String(e)), { kind: 'network' });
      }
    }
    throw lastErr;
  }
  function friendlyError(e) {
    if (!e) return '알 수 없는 오류';
    if (e.name === 'AbortError') return '60초 안에 응답이 없어 중단했습니다. 무한 루프가 없는지 확인하고 다시 실행하세요.';
    if (!navigator.onLine) return '인터넷에 연결되어 있지 않습니다. 와이파이나 데이터 연결을 확인한 뒤 다시 실행하세요.';
    if (e.kind === 'server') return '컴파일 서버(Wandbox)가 오류를 돌려주었습니다. 3번 다시 시도했지만 실패했어요. 잠시 후 다시 실행하세요.\n\n' + e.message;
    return '컴파일 서버(Wandbox)에 연결하지 못했습니다. 3번 다시 시도했지만 실패했어요.\n' +
      '무료 공개 서버라 가끔 잠깐씩 응답이 없거나, 실행 중에 다른 앱으로 넘어가면 연결이 끊길 수 있습니다. 잠시 후 다시 실행하세요.\n\n(' + e.message + ')';
  }

  async function execute(stdin, signal, onRetry) {
    const req = buildRequest(stdin);
    if (lintCtrl) { lintCtrl.abort(); lintCtrl = null; } // 실행 중에는 문법 검사 요청을 멈춤
    const t0 = performance.now();
    const j = await postCompile(req, signal, onRetry);
    const ms = Math.round(performance.now() - t0);
    j._ms = ms;
    diagsFromRun(j);
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
    showIO(true);
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
      const res = await execute(t.input, running.signal, (a) => setVerdict('warn', '서버 응답이 없어 다시 시도 중 (' + a + '/3)', p.compiler, true));
      const v = classify(res, t.expected);
      lastOutput = res.program_output || '';
      testState[i] = v.cls === 'pass' ? 'pass' : v.cls === 'fail' ? 'fail' : undefined;
      setVerdict(v.cls, v.label, '테스트 ' + (i + 1) + ' · 왕복 ' + res._ms + ' ms (네트워크 포함)');
      showResult(res, t.expected, v);
    } catch (e) {
      testState[i] = undefined;
      setVerdict('fail', '요청 실패', '');
      out.textContent = friendlyError(e);
    } finally {
      clearTimeout(timer); running = null; setBusy(false); renderTestTabs();
    }
  }

  async function runAll() {
    if (running) return;
    showIO(true);
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
          else out.textContent = friendlyError(r && r.err);
        });
        sum.append(chip);
      });
      const show = firstFail >= 0 ? firstFail : p.activeTest;
      const r = results[show];
      p.activeTest = show; showTest();
      if (r && r.res) { lastOutput = r.res.program_output || ''; showResult(r.res, p.tests[show].expected, r.v); }
      else if (r && r.err) out.textContent = friendlyError(r.err);
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
    const esc = (e) => { if (e.key === 'Escape' && !e.defaultPrevented) { e.preventDefault(); close(); onCancel && onCancel(); } };
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
      const all = Object.values(db.projects);
      const groups = [...new Set(all.map(pr => pr.group || ''))].sort((a, b) => (a === '') - (b === '') || a.localeCompare(b));
      for (const g of groups) {
        const items = all.filter(pr => (pr.group || '') === g);
        if (g) items.sort((a, b) => (a.order || 0) - (b.order || 0)); else items.sort((a, b) => b.updated - a.updated);
        if (groups.length > 1 || g) list.append(el('div', { class: 'group-h' }, g || '내 문제'));
        for (const pr of items) {
          list.append(el('button', { class: 'btn' + (pr.id === db.current ? ' cur' : ''), type: 'button', onclick: () => {
            db.current = pr.id; testState.length = 0; lastOutput = null; save(STORE_KEY, db); renderAll(); close();
          } }, pr.name + '  ·  ' + LANGS[pr.lang].label));
        }
      }
      const imp = el('input', { type: 'file', id: 'zipImport', multiple: true, hidden: true,
        accept: '.zip,.cpp,.cc,.c,.h,.hpp,.java,.py,.txt,.md,.png,.jpg,.jpeg,.gif,.webp' });
      imp.addEventListener('change', async () => {
        const files = [...imp.files]; if (!files.length) return;
        close();
        try { await importFiles(files); } catch (e) { toast('불러오지 못했습니다: ' + (e.message || e)); }
      });
      body.append(el('div', { class: 'row' },
        el('label', { class: 'btn primary', for: 'zipImport', role: 'button', tabindex: '0' }, '문제 묶음 불러오기 (zip·파일)'), imp),
        el('p', null, 'zip 안의 코드 파일은 각각 문제로, 문제 원문·이미지는 \'자료\'로 들어갑니다. 내용은 이 기기에만 저장됩니다.'));
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
      const ac = el('input', { type: 'checkbox', id: 'prefComplete', checked: prefs.complete });
      ac.addEventListener('change', () => { prefs.complete = ac.checked; save(PREF_KEY, prefs); });
      const aw = el('input', { type: 'checkbox', id: 'prefWords', checked: prefs.words });
      aw.addEventListener('change', () => { prefs.words = aw.checked; save(PREF_KEY, prefs); });
      const li = el('input', { type: 'checkbox', id: 'prefLint', checked: prefs.lint });
      li.addEventListener('change', () => { prefs.lint = li.checked; save(PREF_KEY, prefs); if (!li.checked) setDiags({}); else scheduleLint(); });
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
        el('div', { class: 'row' }, el('label', { for: 'prefLint' }, li, ' 입력 중 문법 검사 (틀린 곳 빨간 밑줄, C/C++)')),
        el('div', { class: 'row' }, el('label', { for: 'prefComplete' }, ac, ' 자동완성 (. 이나 -> 뒤에 멤버 목록, C/C++)')),
        el('div', { class: 'row' }, el('label', { for: 'prefWords' }, aw, ' 입력 중 단어 자동완성 (두 글자부터)')),
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
    diags = {}; editVersion++;
    renderTop(); renderFileTabs(); showFile(); renderTestTabs(); showTest();
    renderLintBar(); scheduleLint();
    out.innerHTML = ''; $('summary').innerHTML = '';
    setVerdict('info', '대기', '실행 버튼을 누르면 서버에서 컴파일 후 실행합니다.');
  }

  // ---------- Materials (IndexedDB: 이미지·문제 원문) ----------
  const MAT_DB = 'proide-materials', MAT_STORE = 'items';
  function matOpen() {
    return new Promise((res, rej) => {
      let r;
      try { r = indexedDB.open(MAT_DB, 1); } catch (e) { rej(e); return; }
      r.onupgradeneeded = () => r.result.createObjectStore(MAT_STORE, { keyPath: 'id' });
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
  }
  async function matTx(mode, fn) {
    const d = await matOpen();
    return new Promise((res, rej) => {
      const tx = d.transaction(MAT_STORE, mode);
      const st = tx.objectStore(MAT_STORE);
      const out = fn(st);
      tx.oncomplete = () => res(out && out.result !== undefined ? out.result : undefined);
      tx.onerror = () => rej(tx.error);
    });
  }
  const matAll = () => matTx('readonly', st => st.getAll());
  const matPut = (m) => matTx('readwrite', st => st.put(m));
  const matDel = (id) => matTx('readwrite', st => st.delete(id));

  const CODE_EXT = { cpp: 'cpp', cc: 'cpp', cxx: 'cpp', c: 'c', java: 'java', py: 'python' };
  const IMG_EXT = /\.(png|jpe?g|gif|webp)$/i;
  const TEXT_EXT = /\.(txt|md|h|hpp)$/i;
  const baseName = (path) => path.split('/').pop();
  const cleanFile = (n) => n.replace(/\s+/g, '_');
  const prettyName = (n) => n.replace(/\.[^.]+$/, '').replace(/^\d+[_\-\s]+/, '').replace(/[_\-]+/g, ' ').trim() || n;
  const pairKey = (n) => { const m = n.toLowerCase().match(/(?:^|[_\-\s])(p\d+)(?=[_\-\s.])/); return m ? m[1] : null; };
  async function decodeText(buf) {
    try { return new TextDecoder('utf-8', { fatal: true }).decode(buf); }
    catch (e) { try { return new TextDecoder('euc-kr').decode(buf); } catch (e2) { return new TextDecoder().decode(buf); } }
  }

  // entries: [{ name, kind: 'code'|'text'|'image', lang?, text?, blob? }]
  async function importFiles(files) {
    const entries = [];
    let group = '';
    for (const f of files) {
      if (/\.zip$/i.test(f.name)) {
        if (typeof JSZip === 'undefined') throw new Error('압축 해제 도구를 불러오지 못했습니다');
        group = group || f.name.replace(/\.zip$/i, '');
        const zip = await JSZip.loadAsync(f);
        const names = Object.keys(zip.files).filter(n => !zip.files[n].dir && !/(^|\/)(__MACOSX|\.)/.test(n)).sort();
        for (const n of names) entries.push(await toEntry(baseName(n), () => zip.files[n].async('uint8array')));
      } else {
        entries.push(await toEntry(f.name, async () => new Uint8Array(await f.arrayBuffer())));
      }
    }
    if (!group) group = '불러온 파일';
    const valid = entries.filter(Boolean);
    const codes = valid.filter(e => e.kind === 'code');
    const used = new Set();
    let added = 0, skipped = 0, mats = 0, order = 0;
    for (const c of codes) {
      order++;
      const name = prettyName(c.name);
      const k = pairKey(c.name);
      const paired = k ? valid.filter(t => t.kind === 'text' && pairKey(t.name) === k) : [];
      paired.forEach(t => used.add(t));
      if (Object.values(db.projects).some(pr => pr.group === group && pr.name === name)) { skipped++; continue; }
      const p = {
        id: uid(), name, lang: c.lang, compiler: '', flags: LANGS[c.lang].flags || '', group, order,
        files: [{ name: cleanFile(c.name), code: c.text }],
        tests: [{ input: '', expected: '' }], activeFile: 0, activeTest: 0, updated: Date.now(),
      };
      for (const t of paired) p.files.push({ name: cleanFile(t.name), code: t.text });
      db.projects[p.id] = p; added++;
      if (added === 1) db.current = p.id;
    }
    const existing = await matAll().catch(() => []);
    for (const e of valid) {
      if (e.kind === 'code' || used.has(e)) continue;
      if (existing.some(m => m.group === group && m.name === e.name)) continue;
      try {
        await matPut({ id: uid(), group, name: e.name, kind: e.kind, text: e.text, blob: e.blob, order: mats, added: Date.now() });
        mats++;
      } catch (err) { toast('자료 저장 실패: ' + e.name); }
    }
    save(STORE_KEY, db); testState.length = 0; lastOutput = null; renderAll();
    let msg = (added || mats) ? `문제 ${added}개` + (mats ? `, 자료 ${mats}개` : '') + '를 불러왔습니다' : '새로 불러올 내용이 없습니다';
    if (skipped) msg += ` (이미 있는 문제 ${skipped}개는 그대로 둠)`;
    toast(msg);
  }
  async function toEntry(name, getBytes) {
    const ext = (name.match(/\.([^.]+)$/) || [])[1];
    const lower = (ext || '').toLowerCase();
    if (CODE_EXT[lower]) return { name, kind: 'code', lang: CODE_EXT[lower], text: await decodeText(await getBytes()) };
    if (IMG_EXT.test(name)) {
      const type = lower === 'png' ? 'image/png' : lower === 'gif' ? 'image/gif' : lower === 'webp' ? 'image/webp' : 'image/jpeg';
      return { name, kind: 'image', blob: new Blob([await getBytes()], { type }) };
    }
    if (TEXT_EXT.test(name)) return { name, kind: 'text', text: await decodeText(await getBytes()) };
    return null;
  }

  function openViewer(m) {
    const v = el('div', { class: 'viewer', role: 'dialog', 'aria-modal': 'true', 'aria-label': m.name });
    let url = null;
    const close = () => { if (url) URL.revokeObjectURL(url); v.remove(); document.removeEventListener('keydown', esc); };
    const esc = (e) => { if (e.key === 'Escape' && !e.defaultPrevented) { e.preventDefault(); close(); } };
    document.addEventListener('keydown', esc);
    const bar = el('div', { class: 'viewer-bar' }, el('h2', null, m.name));
    if (m.kind === 'text') {
      bar.append(el('button', { class: 'btn small', type: 'button', onclick: () => copyText(m.text, '복사했습니다') }, '복사'));
      bar.append(el('button', { class: 'btn small', type: 'button', onclick: () => {
        const p = newProject(prettyName(m.name), 'cpp');
        p.group = m.group; p.order = 1000;
        p.files = [{ name: 'main.cpp', code: '#include <cstdio>\n#include <cstring>\n#include <vector>\n#include <set>\n#include <unordered_map>\nusing namespace std;\n\nint main() {\n\n    return 0;\n}\n' },
                   { name: cleanFile(m.name), code: m.text }];
        p.tests = [{ input: '', expected: '' }];
        db.projects[p.id] = p; db.current = p.id; testState.length = 0; lastOutput = null;
        save(STORE_KEY, db); renderAll(); close(); toast('풀이용 문제를 만들었습니다');
      } }, '이 문제로 풀이 만들기'));
    }
    bar.append(el('button', { class: 'btn small', type: 'button', onclick: close }, '닫기'));
    const body = el('div', { class: 'viewer-body' });
    if (m.kind === 'image') { url = URL.createObjectURL(m.blob); body.append(el('img', { src: url, alt: m.name })); }
    else body.append(el('pre', null, m.text));
    v.append(bar, body);
    document.body.append(v);
  }

  $('matBtn').addEventListener('click', async () => {
    let items = [];
    try { items = await matAll(); } catch (e) { toast('자료를 읽을 수 없습니다'); }
    sheet('자료', (body, close) => {
      if (!items.length) {
        body.append(el('p', null, '아직 자료가 없습니다. 문제 목록에서 \'문제 묶음 불러오기\'로 zip 파일을 고르면 문제 원문과 카드 이미지가 여기에 들어옵니다.'));
        return;
      }
      const groups = [...new Set(items.map(m => m.group))];
      for (const g of groups) {
        body.append(el('div', { class: 'group-h' }, g));
        const list = el('div', { class: 'list' });
        for (const m of items.filter(x => x.group === g).sort((a, b) => a.name.localeCompare(b.name))) {
          const del = el('button', { class: 'btn small', type: 'button', title: '삭제' }, '삭제');
          let armed = false;
          del.addEventListener('click', async () => {
            if (!armed) { armed = true; del.textContent = '확인'; del.classList.add('danger'); return; }
            await matDel(m.id).catch(() => {}); del.parentElement.remove();
          });
          list.append(el('div', { class: 'mat-item' },
            el('button', { class: 'btn', type: 'button', onclick: () => { close(); openViewer(m); } }, prettyName(m.name)),
            el('span', { class: 'mat-kind' }, m.kind === 'image' ? '이미지' : '글'), del));
        }
        body.append(list);
      }
    });
  });

  // ---------- 문법 검사 (빨간 밑줄) ----------
  // 입력을 멈추고 잠시 뒤 서버에서 -fsyntax-only 로 문법만 검사합니다 (C/C++).
  // 실행했을 때 나온 컴파일 에러도 같은 방식으로 표시합니다 (Java, Python 포함).
  let diags = {};          // 파일 이름 -> [{ line, col, sev, msg }]
  let editVersion = 0, lintTimer = null, lintSeq = 0, lintCtrl = null, lintCursor = 0;
  let lintMarks = [];      // { doc, mark?, handle?, cls? }

  function lintable() { const p = P(); return prefs.lint && (p.lang === 'cpp' || p.lang === 'c'); }
  function scheduleLint() {
    clearTimeout(lintTimer);
    if (!lintable()) return;
    lintTimer = setTimeout(runLint, 1300);
  }
  async function runLint() {
    if (!lintable()) return;
    if (!navigator.onLine) return;
    if (running) { scheduleLint(); return; }
    const myVer = editVersion, seq = ++lintSeq;
    if (lintCtrl) lintCtrl.abort();
    lintCtrl = new AbortController();
    const req = buildRequest('');
    const raw = (req['compiler-option-raw'] || '').split('\n').filter(x => x && x !== '-O2' && x !== '-O3');
    raw.push('-fsyntax-only');
    req['compiler-option-raw'] = raw.join('\n');
    try {
      const r = await fetch(API + '/compile.json', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(req), signal: lintCtrl.signal });
      if (!r.ok) return;
      const j = await r.json();
      if (seq !== lintSeq || myVer !== editVersion) return; // 그 사이 코드가 바뀜: 다음 검사 결과를 기다림
      const found = parseDiags(j.compiler_error || '');
      whenIdle(() => { if (seq === lintSeq && myVer === editVersion) setDiags(found); });
    } catch (e) { /* 네트워크 오류는 조용히 무시 */ }
  }

  function parseDiags(text) {
    const p = P();
    const mainName = LANGS[p.lang].mainName;
    const out = {};
    const re = /^(.+?):(\d+):(?:(\d+):)?\s*(fatal error|error|warning):\s*(.*)$/gm;
    let m;
    while ((m = re.exec(text))) {
      let fname = m[1].trim().replace(/^\.\//, '');
      if (fname === mainName) fname = p.files[0].name;
      if (!p.files.some(f => f.name === fname)) continue;
      const d = { line: +m[2], col: m[3] ? +m[3] : 0, sev: m[4] === 'warning' ? 'warn' : 'error', msg: m[5].trim() };
      (out[fname] = out[fname] || []);
      if (!out[fname].some(x => x.line === d.line && x.col === d.col && x.sev === d.sev)) out[fname].push(d);
    }
    // Python 실행 에러: File "prog.py", line N ... 마지막 줄이 에러 메시지
    if (p.lang === 'python') {
      const lines = text.trim().split('\n');
      const last = lines[lines.length - 1] || '';
      let loc = null;
      const re2 = /File "([^"]+)", line (\d+)/g;
      while ((m = re2.exec(text))) loc = m;
      if (loc && /(Error|Exception)/.test(last)) {
        let fname = loc[1].split('/').pop();
        if (fname === mainName) fname = p.files[0].name;
        if (p.files.some(f => f.name === fname)) (out[fname] = out[fname] || []).push({ line: +loc[2], col: 0, sev: 'error', msg: last.trim() });
      }
    }
    return out;
  }
  function diagsFromRun(j) {
    const p = P();
    if (p.lang === 'python') { setDiags(parseDiags((j.program_error || '') + '\n' + (j.compiler_error || ''))); return; }
    if (!prefs.lint && p.lang !== 'java' && !(j.compiler_error || '').trim()) { setDiags({}); return; }
    setDiags(parseDiags(j.compiler_error || ''));
  }
  function setDiags(d) {
    diags = d || {};
    lintCursor = 0;
    applyDiags();
    renderLintBar();
  }
  function clearMarks() {
    for (const m of lintMarks) {
      try {
        if (m.mark) m.mark.clear();
        if (m.handle) m.doc.removeLineClass(m.handle, 'background', m.cls);
      } catch (e) { /* 이미 지워진 줄 */ }
    }
    lintMarks = [];
    if (cm) cm.clearGutter('lint-gutter');
  }
  function applyDiags() {
    clearMarks();
    if (!cm) return;
    const f = P().files[P().activeFile];
    const list = (f && diags[f.name]) || [];
    const doc = cm.getDoc();
    for (const d of list) {
      const ln = Math.min(Math.max(0, d.line - 1), doc.lineCount() - 1);
      const text = doc.getLine(ln) || '';
      let ch = d.col > 0 ? d.col - 1 : text.search(/\S/);
      if (ch < 0) ch = 0;
      let from = Math.min(ch, Math.max(0, text.length - 1)), to;
      if (d.col > 0 && /\w/.test(text[from] || '')) { to = from; while (to < text.length && /\w/.test(text[to])) to++; }
      else if (d.col > 0) to = Math.min(text.length, from + 1);
      else to = text.length;
      const cls = d.sev === 'warn' ? 'cm-lint-warn' : 'cm-lint-error';
      if (to > from) lintMarks.push({ doc, mark: doc.markText({ line: ln, ch: from }, { line: ln, ch: to }, { className: cls, attributes: { title: d.msg } }) });
      const bg = d.sev === 'warn' ? 'lint-bg-warn' : 'lint-bg-error';
      lintMarks.push({ doc, handle: doc.addLineClass(ln, 'background', bg), cls: bg });
      const dot = document.createElement('span');
      dot.className = 'lint-dot ' + d.sev; dot.textContent = d.sev === 'warn' ? '!' : '✕'; dot.title = d.msg;
      cm.setGutterMarker(ln, 'lint-gutter', dot);
    }
  }
  function allDiags() {
    const p = P();
    const out = [];
    p.files.forEach((f, i) => (diags[f.name] || []).forEach(d => out.push(Object.assign({ file: i, fname: f.name }, d))));
    out.sort((a, b) => (a.sev === 'warn') - (b.sev === 'warn') || (a.file !== P().activeFile) - (b.file !== P().activeFile) || a.file - b.file || a.line - b.line);
    return out;
  }
  function renderLintBar() {
    const bar = $('lintBar');
    const all = allDiags();
    if (!all.length) { bar.hidden = true; return; }
    const errs = all.filter(d => d.sev === 'error').length, warns = all.length - errs;
    const d = all[lintCursor % all.length];
    bar.hidden = false;
    bar.className = 'lintbar' + (errs ? '' : ' warn');
    bar.innerHTML = '';
    const where = (d.file !== P().activeFile ? d.fname + ' ' : '') + d.line + '줄';
    bar.append(
      el('span', { class: 'lb-count' }, errs ? '✕ 오류 ' + errs + (warns ? ' · 경고 ' + warns : '') : '! 경고 ' + warns),
      el('span', { class: 'lb-msg' }, where + ': ' + d.msg));
    if (all.length > 1) bar.append(el('span', { class: 'lb-next' }, '다음 ›'));
    bar.title = where + ': ' + d.msg;
  }
  $('lintBar').addEventListener('click', () => {
    const all = allDiags();
    if (!all.length) return;
    const d = all[lintCursor % all.length];
    jumpTo(d.file, d.line);
    lintCursor = (lintCursor + 1) % all.length;
    renderLintBar();
  });

  // ---------- Focus (full-screen editor) ----------
  const app = document.querySelector('.app');
  const isFocus = () => app.classList.contains('focus');
  function refreshEditorSoon() {
    const r = () => whenIdle(() => cm && cm.refresh());
    setTimeout(r, 60); setTimeout(r, 400);
  }
  function setFocus(on) {
    app.classList.toggle('focus', on);
    app.classList.remove('show-io');
    prefs.focus = on; prefs.focusFs = on; save(PREF_KEY, prefs);
    const de = document.documentElement;
    try {
      if (on && !document.fullscreenElement && !document.webkitFullscreenElement) {
        const req = de.requestFullscreen || de.webkitRequestFullscreen;
        if (req) { const r = req.call(de); if (r && r.catch) r.catch(() => {}); }
      } else if (!on && (document.fullscreenElement || document.webkitFullscreenElement)) {
        const ex = document.exitFullscreen || document.webkitExitFullscreen;
        if (ex) { const r = ex.call(document); if (r && r.catch) r.catch(() => {}); }
      }
    } catch (e) { /* 전체화면 API가 없는 브라우저: 화면 배치만 바꿈 */ }
    renderFileTabs();
    refreshEditorSoon();
    editorFocus();
  }
  function showIO(on) {
    if (!isFocus()) return;
    app.classList.toggle('show-io', on);
    if (!on) editorFocus();
    refreshEditorSoon();
  }
  // 다른 앱에 다녀오거나 화면 위를 끌어내려 전체화면이 풀리면, 다음 터치 때 다시 전체화면으로
  const fsActive = () => !!(document.fullscreenElement || document.webkitFullscreenElement);
  const appFullscreen = () => { try { return matchMedia('(display-mode: fullscreen)').matches; } catch (e) { return false; } };
  function reenterFullscreen() {
    if (!isFocus() || fsActive() || appFullscreen() || !prefs.focusFs) return;
    const de = document.documentElement;
    const req = de.requestFullscreen || de.webkitRequestFullscreen;
    if (!req) return;
    try { const r = req.call(de, { navigationUI: 'hide' }); if (r && r.catch) r.catch(() => {}); } catch (e) { /* 무시 */ }
  }
  document.addEventListener('click', reenterFullscreen, true);
  document.addEventListener('touchend', reenterFullscreen, true);
  document.addEventListener('keydown', (e) => { if (!e.metaKey && !e.ctrlKey && !e.altKey) reenterFullscreen(); }, true);
  const onFsChange = () => refreshEditorSoon();
  document.addEventListener('fullscreenchange', onFsChange);
  document.addEventListener('webkitfullscreenchange', onFsChange);

  $('fbRun').addEventListener('click', runCurrent);
  $('fbRunAll').addEventListener('click', runAll);
  $('fbIO').addEventListener('click', () => showIO(!app.classList.contains('show-io')));
  $('fbExit').addEventListener('click', () => setFocus(false));
  $('drawerClose').addEventListener('click', () => showIO(false));
  // 키보드가 올라오거나 내려갈 때(높이만 바뀜)는 다시 그리지 않음. 가로 폭이 바뀔 때만(회전 등)
  let lastWidth = window.innerWidth;
  window.addEventListener('resize', () => { if (window.innerWidth !== lastWidth) { lastWidth = window.innerWidth; refreshEditorSoon(); } });

  // ---------- Esc 키와 뒤로 가기 ----------
  // 안드로이드에서는 처리하지 않은 Esc 키가 '뒤로 가기'가 되어 앱이 닫힙니다.
  // Esc는 항상 여기서 처리하고(열린 창 닫기), 뒤로 가기 버튼/제스처는 열린 창을 먼저 닫습니다.
  function closeTopmost() {
    if (cm && cm.state.completionActive) { cm.state.completionActive.close(); return true; }
    const viewer = document.querySelector('.viewer');
    if (viewer) { const b = viewer.querySelector('.viewer-bar .btn:last-child'); if (b) b.click(); else viewer.remove(); return true; }
    const sheets = document.querySelectorAll('.sheet-bg');
    if (sheets.length) { const bg = sheets[sheets.length - 1]; bg.dispatchEvent(new MouseEvent('click', { bubbles: true })); return true; }
    if (app.classList.contains('show-io')) { showIO(false); return true; }
    return false;
  }
  window.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape' && e.key !== 'Esc') return;
    const handled = e.defaultPrevented; // 자동완성 목록이나 열린 창이 이미 처리함
    e.preventDefault();
    if (!handled) closeTopmost();
  });
  let trapArmed = false;
  function armBackTrap() {
    if (trapArmed) return;
    try { history.pushState({ proTrap: Date.now() }, ''); trapArmed = true; } catch (e) { /* 무시 */ }
  }
  // 사용자 동작이 있을 때 넣어야 브라우저가 이 기록을 '뒤로 가기' 대상으로 인정합니다.
  ['click', 'touchend', 'keyup'].forEach(t => document.addEventListener(t, armBackTrap, true));
  window.addEventListener('popstate', () => {
    trapArmed = false; // 다음 터치 때 다시 걸어 둠. 그 전에 한 번 더 누르면 앱이 닫힘
    if (closeTopmost()) return;
    toast('뒤로 가기를 한 번 더 누르면 앱이 닫힙니다');
  });

  // ---------- Boot ----------
  applyPrefs();
  setupEditor();
  renderKeys();
  renderAll();
  if (prefs.focus) { app.classList.add('focus'); renderFileTabs(); refreshEditorSoon(); }
  fetchCompilers();
  if ('serviceWorker' in navigator && location.protocol === 'https:') {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
  window.__proide = { buildRequest, normalize, classify, editorBusy };
})();
