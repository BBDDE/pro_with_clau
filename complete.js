/* PRO 연습장 — C/C++ 자동완성
 * Visual Studio처럼 `변수.` / `포인터->` 뒤에 멤버 목록을 보여 줍니다.
 * 컴파일러 없이 코드를 읽어서 추정하므로, 직접 만든 struct/class, STL 컨테이너,
 * 배열·포인터·반복자, auto, 범위 for 정도를 다룹니다.
 */
(function () {
  'use strict';

  // ---------- 기본 단어 ----------
  const KEYWORDS = ('auto bool break case char class const continue default delete do double else enum extern false float for ' +
    'if inline int long namespace new nullptr operator private protected public return short signed sizeof static struct ' +
    'switch template this true typedef typename unsigned using virtual void while').split(' ');
  const STD_WORDS = ('vector set map unordered_map unordered_set multiset multimap queue priority_queue stack deque list string ' +
    'pair make_pair bitset array tuple sort stable_sort lower_bound upper_bound min max swap reverse unique fill memset memcpy ' +
    'strcpy strncpy strcmp strncmp strlen strcat printf scanf puts getchar greater less abs iterator begin end npos ' +
    'size_t INT_MAX INT_MIN LLONG_MAX LLONG_MIN emplace_back push_back').split(' ');
  const PRIMS = new Set(('int long short char bool float double void size_t unsigned signed ll ull lld int8_t int16_t int32_t ' +
    'int64_t uint8_t uint16_t uint32_t uint64_t wchar_t').split(' '));
  const NOT_TYPE = new Set(('return else case delete new throw goto do sizeof typedef using namespace public private protected ' +
    'if while for switch break continue').split(' '));

  // ---------- STL 멤버 표 ----------
  // [이름, 매개변수, 반환 형식, 설명]
  // 반환 형식: T0/T1 = 템플릿 인자, @it = 반복자, @ins = insert 결과, 그 외는 그대로 형식 이름
  const C_COMMON = [
    ['size', '()', 'size_t', '원소 개수'],
    ['empty', '()', 'bool', '비어 있으면 true'],
    ['clear', '()', 'void', '모두 삭제'],
    ['swap', '(other)', 'void', '내용 교환 O(1)'],
  ];
  const C_ITER = [
    ['begin', '()', '@it', '첫 원소 반복자'],
    ['end', '()', '@it', '마지막 다음 위치 반복자'],
    ['rbegin', '()', '@it', '역순 시작 반복자 (마지막 원소)'],
    ['rend', '()', '@it', '역순 끝 반복자'],
  ];
  const VEC = [
    ['push_back', '(x)', 'void', '맨 뒤에 추가 O(1)'],
    ['emplace_back', '(args...)', 'void', '맨 뒤에 바로 생성해 추가'],
    ['pop_back', '()', 'void', '맨 뒤 원소 삭제'],
    ['back', '()', 'T0', '마지막 원소'],
    ['front', '()', 'T0', '첫 원소'],
    ['at', '(i)', 'T0', 'i번째 원소 (범위 검사)'],
    ['insert', '(it, x)', '@it', 'it 위치에 삽입 O(N)'],
    ['erase', '(it)', '@it', 'it 위치 삭제 O(N)'],
    ['resize', '(n)', 'void', '크기를 n으로'],
    ['reserve', '(n)', 'void', '용량 미리 확보'],
    ['assign', '(n, x)', 'void', 'x로 n개 채움'],
    ['data', '()', 'T0*', '내부 배열 포인터'],
    ['capacity', '()', 'size_t', '현재 용량'],
  ].concat(C_COMMON, C_ITER);
  const DEQ = VEC.filter(m => !['reserve', 'data', 'capacity'].includes(m[0])).concat([
    ['push_front', '(x)', 'void', '맨 앞에 추가 O(1)'],
    ['emplace_front', '(args...)', 'void', '맨 앞에 바로 생성해 추가'],
    ['pop_front', '()', 'void', '맨 앞 원소 삭제'],
  ]);
  const LST = [
    ['push_back', '(x)', 'void', '맨 뒤에 추가'],
    ['push_front', '(x)', 'void', '맨 앞에 추가'],
    ['emplace_back', '(args...)', 'void', '맨 뒤에 생성해 추가'],
    ['emplace_front', '(args...)', 'void', '맨 앞에 생성해 추가'],
    ['pop_back', '()', 'void', '맨 뒤 삭제'],
    ['pop_front', '()', 'void', '맨 앞 삭제'],
    ['front', '()', 'T0', '첫 원소'],
    ['back', '()', 'T0', '마지막 원소'],
    ['insert', '(it, x)', '@it', 'it 앞에 삽입 O(1)'],
    ['erase', '(it)', '@it', 'it 삭제 O(1), 다음 반복자 반환'],
    ['remove', '(x)', 'void', '값이 x인 원소 모두 삭제'],
    ['splice', '(pos, other, it)', 'void', '다른 list의 원소를 옮김 O(1)'],
    ['sort', '()', 'void', '정렬'],
    ['reverse', '()', 'void', '뒤집기'],
    ['unique', '()', 'void', '연속 중복 제거'],
  ].concat(C_COMMON, C_ITER);
  const SET = [
    ['insert', '(x)', '@ins', '삽입 O(logN)'],
    ['emplace', '(args...)', '@ins', '바로 생성해 삽입'],
    ['erase', '(x 또는 it)', 'size_t', '값 또는 반복자 위치 삭제'],
    ['find', '(x)', '@it', '찾기, 없으면 end()'],
    ['count', '(x)', 'size_t', '개수 (set은 0 또는 1)'],
    ['lower_bound', '(x)', '@it', 'x 이상인 첫 원소'],
    ['upper_bound', '(x)', '@it', 'x 초과인 첫 원소'],
  ].concat(C_COMMON, C_ITER);
  const USET = SET.filter(m => !['lower_bound', 'upper_bound'].includes(m[0])).filter(m => !/^r/.test(m[0]))
    .concat([['reserve', '(n)', 'void', '버킷 미리 확보 (속도 향상)']]);
  const MAP = [
    ['insert', '({key, value})', '@ins', '삽입 (이미 있으면 무시)'],
    ['emplace', '(key, value)', '@ins', '바로 생성해 삽입'],
    ['erase', '(key 또는 it)', 'size_t', '키 또는 반복자 위치 삭제'],
    ['find', '(key)', '@it', '찾기, 없으면 end()'],
    ['count', '(key)', 'size_t', '키 개수 (0 또는 1)'],
    ['at', '(key)', 'T1', '값 (키가 없으면 예외)'],
    ['lower_bound', '(key)', '@it', 'key 이상인 첫 원소'],
    ['upper_bound', '(key)', '@it', 'key 초과인 첫 원소'],
  ].concat(C_COMMON, C_ITER);
  const UMAP = MAP.filter(m => !['lower_bound', 'upper_bound'].includes(m[0])).filter(m => !/^r/.test(m[0]))
    .concat([['reserve', '(n)', 'void', '버킷 미리 확보 (속도 향상)']]);
  const QUE = [
    ['push', '(x)', 'void', '맨 뒤에 추가'],
    ['emplace', '(args...)', 'void', '바로 생성해 추가'],
    ['pop', '()', 'void', '맨 앞 삭제 (값 반환 안 함)'],
    ['front', '()', 'T0', '맨 앞 원소'],
    ['back', '()', 'T0', '맨 뒤 원소'],
  ].concat(C_COMMON.filter(m => m[0] !== 'clear'));
  const PQ = [
    ['push', '(x)', 'void', '추가 O(logN)'],
    ['emplace', '(args...)', 'void', '바로 생성해 추가'],
    ['pop', '()', 'void', '최우선 원소 삭제'],
    ['top', '()', 'T0', '최우선 원소 (기본은 가장 큰 값)'],
  ].concat(C_COMMON.filter(m => m[0] !== 'clear'));
  const STK = [
    ['push', '(x)', 'void', '위에 추가'],
    ['emplace', '(args...)', 'void', '바로 생성해 추가'],
    ['pop', '()', 'void', '맨 위 삭제'],
    ['top', '()', 'T0', '맨 위 원소'],
  ].concat(C_COMMON.filter(m => m[0] !== 'clear'));
  const STR = [
    ['length', '()', 'size_t', '글자 수'],
    ['push_back', '(c)', 'void', '글자 추가'],
    ['pop_back', '()', 'void', '마지막 글자 삭제'],
    ['back', '()', 'char', '마지막 글자'],
    ['front', '()', 'char', '첫 글자'],
    ['at', '(i)', 'char', 'i번째 글자'],
    ['substr', '(pos, len)', 'string', '부분 문자열'],
    ['find', '(s, pos)', 'size_t', '찾기, 없으면 string::npos'],
    ['rfind', '(s)', 'size_t', '뒤에서부터 찾기'],
    ['c_str', '()', 'const char*', 'C 문자열 포인터'],
    ['append', '(s)', 'string', '뒤에 붙이기'],
    ['insert', '(pos, s)', 'string', 'pos 위치에 삽입'],
    ['erase', '(pos, len)', 'string', '부분 삭제'],
    ['replace', '(pos, len, s)', 'string', '부분 바꾸기'],
    ['compare', '(s)', 'int', '사전순 비교 (<0, 0, >0)'],
    ['resize', '(n)', 'void', '길이를 n으로'],
  ].concat(C_COMMON, C_ITER);
  const BITS = [
    ['set', '(i)', 'void', 'i번째 비트 1'],
    ['reset', '(i)', 'void', 'i번째 비트 0'],
    ['flip', '(i)', 'void', 'i번째 비트 반전'],
    ['test', '(i)', 'bool', 'i번째 비트 확인'],
    ['count', '()', 'size_t', '1인 비트 수'],
    ['any', '()', 'bool', '1이 하나라도 있으면 true'],
    ['none', '()', 'bool', '모두 0이면 true'],
    ['all', '()', 'bool', '모두 1이면 true'],
    ['size', '()', 'size_t', '비트 수'],
    ['to_string', '()', 'string', '"0101" 형태 문자열'],
  ];
  const ARR = [
    ['fill', '(x)', 'void', '모두 x로'],
    ['front', '()', 'T0', '첫 원소'],
    ['back', '()', 'T0', '마지막 원소'],
    ['at', '(i)', 'T0', 'i번째 원소'],
    ['data', '()', 'T0*', '내부 배열 포인터'],
    ['size', '()', 'size_t', '원소 개수'],
    ['empty', '()', 'bool', '비어 있으면 true'],
  ].concat(C_ITER);
  const PAIR_FIELDS = [['first', '', 'T0', '첫 번째 값'], ['second', '', 'T1', '두 번째 값']];

  const STL = {
    vector: VEC, deque: DEQ, list: LST,
    set: SET, multiset: SET, unordered_set: USET, unordered_multiset: USET,
    map: MAP, multimap: MAP, unordered_map: UMAP, unordered_multimap: UMAP,
    queue: QUE, priority_queue: PQ, stack: STK, string: STR, bitset: BITS, array: ARR,
  };
  const MAP_LIKE = new Set(['map', 'multimap', 'unordered_map', 'unordered_multimap']);
  const KNOWN_TEMPL = new Set(Object.keys(STL).concat(['pair', 'tuple']));

  // ---------- 텍스트 전처리: 주석·문자열·전처리 줄을 같은 길이의 공백으로 ----------
  function strip(src) {
    const out = [];
    const n = src.length;
    let i = 0, lineStart = true;
    while (i < n) {
      const c = src[i], d = src[i + 1];
      if (c === '\n') { out.push(c); i++; lineStart = true; continue; }
      if (lineStart && c === '#') { while (i < n && src[i] !== '\n') { out.push(' '); i++; } continue; }
      if (c !== ' ' && c !== '\t') lineStart = false;
      if (c === '/' && d === '/') { while (i < n && src[i] !== '\n') { out.push(' '); i++; } continue; }
      if (c === '/' && d === '*') {
        out.push(' ', ' '); i += 2;
        while (i < n && !(src[i] === '*' && src[i + 1] === '/')) { out.push(src[i] === '\n' ? '\n' : ' '); i++; }
        if (i < n) { out.push(' ', ' '); i += 2; }
        continue;
      }
      if (c === '"' || c === "'") {
        out.push(' '); i++;
        while (i < n && src[i] !== c && src[i] !== '\n') {
          if (src[i] === '\\' && i + 1 < n) { out.push(' '); i++; }
          out.push(' '); i++;
        }
        if (i < n && src[i] === c) { out.push(' '); i++; }
        continue;
      }
      out.push(c); i++;
    }
    return out.join('');
  }

  const OPEN = { '(': ')', '[': ']', '{': '}', '<': '>' };
  const CLOSE = { ')': '(', ']': '[', '}': '{', '>': '<' };
  function matchForward(s, i) {
    const o = s[i], c = OPEN[o]; let d = 0;
    for (let k = i; k < s.length; k++) {
      if (s[k] === o) d++;
      else if (s[k] === c) { d--; if (d === 0) return k; }
      else if (o === '<' && (s[k] === ';' || s[k] === '{')) return -1;
    }
    return -1;
  }
  function matchBack(s, i) {
    const c = s[i], o = CLOSE[c]; let d = 0;
    for (let k = i; k >= 0; k--) {
      if (s[k] === c) d++;
      else if (s[k] === o) { d--; if (d === 0) return k; }
      else if (c === '>' && (s[k] === ';' || s[k] === '{' || s[k] === '}')) return -1;
    }
    return -1;
  }
  function splitTop(s, sep) {
    const parts = []; let d = 0, st = 0;
    for (let i = 0; i < s.length; i++) {
      const c = s[i];
      if (c === '(' || c === '[' || c === '{' || c === '<') d++;
      else if (c === ')' || c === ']' || c === '}' || c === '>') d--;
      else if (c === sep && d === 0) { parts.push(s.slice(st, i)); st = i + 1; }
    }
    parts.push(s.slice(st));
    return parts;
  }

  // ---------- 형식 ----------
  // { name, args: [type], ptr: n, arr: n }
  function parseType(str) {
    if (!str) return null;
    const s = String(str).replace(/\bstd::/g, '')
      .replace(/\b(const|static|mutable|volatile|struct|class|union|typename|register|inline|extern|constexpr|unsigned|signed)\b/g, ' ')
      .replace(/&/g, ' ');
    let p = 0;
    const ws = () => { while (p < s.length && /\s/.test(s[p])) p++; };
    function one() {
      ws();
      const m = /^[A-Za-z_]\w*(?:::[A-Za-z_]\w*)*/.exec(s.slice(p));
      if (!m) return null;
      p += m[0].length;
      let name = m[0];
      if (name === 'long' || name === 'short') { ws(); const m2 = /^(long|int|double)\b/.exec(s.slice(p)); if (m2) p += m2[0].length; }
      const t = { name, args: [], ptr: 0, arr: 0 };
      ws();
      if (s[p] === '<') {
        p++;
        for (let guard = 0; p < s.length && guard < 20; guard++) {
          ws();
          if (s[p] === '>') { p++; break; }
          const a = one();
          if (a) t.args.push(a);
          else { const m3 = /^[^,<>]+/.exec(s.slice(p)); if (m3) { t.args.push({ name: m3[0].trim(), args: [], ptr: 0, arr: 0 }); p += m3[0].length; } }
          ws();
          if (s[p] === ',') p++;
          else if (s[p] === '>') { p++; break; }
          else if (p >= s.length) break;
          else p++;
        }
      }
      ws();
      while (s[p] === '*') { t.ptr++; p++; ws(); }
      return t;
    }
    return one();
  }
  const clone = (t) => t && { name: t.name, args: t.args, ptr: t.ptr, arr: t.arr || 0, of: t.of };
  function typeLabel(t) {
    if (!t) return '';
    if (t.name === '@iter') return 'iterator';
    let s = t.name;
    if (t.args && t.args.length) s += '<' + t.args.map(typeLabel).join(', ') + '>';
    s += '*'.repeat(t.ptr || 0);
    s += '[]'.repeat(t.arr || 0);
    return s;
  }

  // ---------- 프로젝트 분석 ----------
  function analyze(files) {
    const structs = {}, aliases = {}, ranges = [];
    files.forEach((f, fi) => {
      const code = f.stripped;
      const re = /\b(struct|class|union)\s+([A-Za-z_]\w*)?\s*(?:final\s*)?(?::\s*([^{;]*))?\{/g;
      let m;
      while ((m = re.exec(code))) {
        const open = m.index + m[0].length - 1;
        const close = matchForward(code, open);
        if (close < 0) continue;
        let name = m[2];
        const after = /^\s*([A-Za-z_]\w*)\s*[;,]/.exec(code.slice(close + 1));
        const before = code.slice(Math.max(0, m.index - 16), m.index);
        if (/typedef\s*$/.test(before) && after) { if (name) aliases[after[1]] = name; else name = after[1]; }
        if (!name) continue;
        const bases = (m[3] || '').split(',').map(b => b.replace(/\b(public|private|protected|virtual)\b/g, '').trim()).filter(Boolean);
        const members = parseMembers(code.slice(open + 1, close), name);
        if (structs[name]) structs[name].members = structs[name].members.concat(members);
        else structs[name] = { name, members, bases };
        ranges.push({ file: fi, start: open, end: close, name });
      }
      const ta = /\btypedef\s+([^;{}()]+?)\s+([A-Za-z_]\w*)\s*;/g;
      while ((m = ta.exec(code))) aliases[m[2]] = m[1];
      const ua = /\busing\s+([A-Za-z_]\w*)\s*=\s*([^;]+);/g;
      while ((m = ua.exec(code))) aliases[m[1]] = m[2];
    });
    return { structs, aliases, ranges };
  }

  function parseMembers(body, sname) {
    const members = [];
    let depth = 0, start = 0;
    for (let i = 0; i < body.length; i++) {
      const c = body[i];
      if (c === '{') { if (depth === 0) addHead(body.slice(start, i)); depth++; }
      else if (c === '}') { depth--; if (depth === 0) start = i + 1; }
      else if (c === ';' && depth === 0) { addHead(body.slice(start, i)); start = i + 1; }
    }
    function addHead(h) {
      h = h.replace(/\b(public|private|protected)\s*:/g, ' ').trim();
      if (!h || /^(struct|class|union|enum|typedef|using|friend|static_assert|template)\b/.test(h)) return;
      const paren = h.indexOf('(');
      const eq = h.indexOf('=');
      if (paren >= 0 && (eq < 0 || paren < eq)) {
        const pre = h.slice(0, paren).trim();
        const m = /(operator\s*\S+|[A-Za-z_~]\w*)\s*$/.exec(pre);
        if (!m) return;
        const name = m[1];
        if (name === sname || name[0] === '~' || /^operator/.test(name)) return;
        const ret = pre.slice(0, m.index).replace(/\b(virtual|static|inline|explicit|constexpr|friend)\b/g, '').trim();
        if (!ret) return;
        const close = matchForward(h, paren);
        const params = h.slice(paren + 1, close > 0 ? close : h.length).replace(/\s+/g, ' ').trim();
        members.push({ name, kind: 'method', type: ret, params });
        return;
      }
      const decl = splitTop(h, ',').map(p => p.replace(/=.*$/s, '').replace(/\{.*$/s, '').trim());
      const fm = /^(.*?)([A-Za-z_]\w*)\s*((?:\[[^\]]*\]\s*)*)$/s.exec(decl[0]);
      if (!fm || !fm[1].trim()) return;
      const base = fm[1].trim();
      const baseNoPtr = base.replace(/[*&\s]+$/, '');
      add(fm[2], base, fm[3]);
      for (const p of decl.slice(1)) {
        const pm = /^([*&\s]*)([A-Za-z_]\w*)\s*((?:\[[^\]]*\]\s*)*)$/.exec(p);
        if (pm) add(pm[2], baseNoPtr + pm[1].replace(/[&\s]/g, ''), pm[3]);
      }
    }
    function add(name, type, dims) {
      members.push({ name, kind: 'field', type: type.trim(), dims: (dims.match(/\[/g) || []).length });
    }
    return members;
  }

  // ---------- 형식 추적 ----------
  function Resolver(ctx) {
    const { structs, aliases } = ctx.info;

    function isTypeWord(w) {
      if (!w) return false;
      w = w.replace(/^std::/, '');
      return PRIMS.has(w) || KNOWN_TEMPL.has(w) || !!structs[w] || !!aliases[w] || w === 'auto' || w === 'string';
    }
    function resolveAlias(t, depth) {
      for (let k = 0; t && k < 5 && aliases[t.name]; k++) {
        const a = parseType(aliases[t.name]);
        if (!a) break;
        a.ptr += t.ptr; a.arr = (a.arr || 0) + (t.arr || 0);
        t = a;
      }
      return t;
    }
    // 이름 앞에 오는 형식 읽기. idx = 이름 시작 위치
    function typeBefore(code, idx, name, depth) {
      let i = idx, ptr = 0;
      while (i > 0 && /[\s*&]/.test(code[i - 1])) { if (code[i - 1] === '*') ptr++; i--; }
      const c = code[i - 1];
      let tstr = null;
      if (c === '>') {
        const o = matchBack(code, i - 1);
        if (o < 0) return null;
        let j = o; while (j > 0 && /\s/.test(code[j - 1])) j--;
        const m = /([A-Za-z_][\w:]*)$/.exec(code.slice(Math.max(0, j - 60), j));
        if (!m || !isTypeWord(m[1])) return null;
        tstr = code.slice(j - m[1].length, i);
      } else if (c && /\w/.test(c)) {
        const m = /([A-Za-z_][\w:]*)$/.exec(code.slice(Math.max(0, i - 60), i));
        if (!m) return null;
        const w = m[1];
        if (/^(const_|reverse_|const_reverse_)?iterator$/.test(w) || /::(const_|reverse_)?iterator$/.test(w)) {
          // list<Node>::iterator it;  /  MyList::iterator it;
          let j = i - w.length;
          const pre2 = code.slice(Math.max(0, j - 2), j);
          let ctype = null;
          if (/::(const_|reverse_)?iterator$/.test(w)) ctype = parseType(w.replace(/::(const_|reverse_|const_reverse_)?iterator$/, ''));
          else if (pre2 === '::') {
            j -= 2;
            while (j > 0 && /\s/.test(code[j - 1])) j--;
            if (code[j - 1] === '>') {
              const o = matchBack(code, j - 1);
              if (o >= 0) { const mm = /([A-Za-z_]\w*)\s*$/.exec(code.slice(Math.max(0, o - 40), o)); if (mm) ctype = parseType(mm[1] + code.slice(o, j)); }
            } else { const mm = /([A-Za-z_]\w*)$/.exec(code.slice(Math.max(0, j - 40), j)); if (mm) ctype = parseType(mm[1]); }
          }
          if (!ctype) return null;
          let k2 = idx + name.length, dims2 = 0;
          for (;;) { while (k2 < code.length && /\s/.test(code[k2])) k2++; if (code[k2] !== '[') break; const cl = matchForward(code, k2); if (cl < 0) break; dims2++; k2 = cl + 1; }
          return { name: '@iter', args: [], ptr, arr: dims2, of: resolveAlias(ctype) };
        }
        if (NOT_TYPE.has(w) || !isTypeWord(w)) return null;
        const pre = code.slice(Math.max(0, i - w.length - 3), i - w.length);
        if (/(\.|->)\s*$/.test(pre)) return null;
        tstr = w;
      } else if (c === ',') {
        let s = i - 1;
        while (s > 0 && !';{}('.includes(code[s - 1])) s--;
        const stmt = code.slice(s, i - 1).replace(/^\s*((const|static|unsigned|signed|register|mutable)\s+)*/, '');
        const m = /^([A-Za-z_][\w:]*)\s*/.exec(stmt);
        if (!m || !isTypeWord(m[1]) || NOT_TYPE.has(m[1])) return null;
        let end = m[0].length;
        if (stmt[end] === '<') { const cl = matchForward(stmt, end); if (cl < 0) return null; end = cl + 1; }
        tstr = stmt.slice(0, end);
      } else return null;

      if (/^\s*auto\s*$/.test(tstr)) {
        // auto x = 식;  /  for (auto& x : 컨테이너)
        let k = idx + name.length;
        while (k < code.length && /\s/.test(code[k])) k++;
        if (code[k] === '=' && code[k + 1] !== '=') {
          const rest = code.slice(k + 1);
          const end = splitTop(rest, ';')[0];
          const expr = splitTop(end, ',')[0];
          return depth > 0 ? resolveExpr(expr, depth - 1, idx) : null;
        }
        if (code[k] === ':' && code[k + 1] !== ':') {
          const rest = code.slice(k + 1);
          const close = (() => { let d = 0; for (let q = 0; q < rest.length; q++) { if (rest[q] === '(') d++; else if (rest[q] === ')') { if (d === 0) return q; d--; } } return -1; })();
          if (close < 0) return null;
          const ct = depth > 0 ? resolveExpr(rest.slice(0, close), depth - 1, idx) : null;
          return ct ? elementOf(ct) : null;
        }
        return null;
      }
      const t = parseType(tstr);
      if (!t) return null;
      t.ptr += ptr;
      // 이름 뒤 배열 차원
      let k = idx + name.length, dims = 0;
      while (true) {
        while (k < code.length && /\s/.test(code[k])) k++;
        if (code[k] !== '[') break;
        const cl = matchForward(code, k); if (cl < 0) break;
        dims++; k = cl + 1;
      }
      t.arr = dims;
      return t;
    }

    function declIn(code, name, from, to, pickLast, depth) {
      const re = new RegExp('\\b' + name.replace(/[$]/g, '\\$') + '\\b', 'g');
      let m, found = null;
      re.lastIndex = from;
      while ((m = re.exec(code)) && m.index < to) {
        const after = code.slice(m.index + name.length).match(/^\s*(.)/);
        if (!after || !'[;,=)({:'.includes(after[1])) continue;
        const t = typeBefore(code, m.index, name, depth);
        if (t) { found = t; if (!pickLast) break; }
      }
      return found;
    }

    function enclosingStruct(idx) {
      let best = null;
      for (const r of ctx.info.ranges) if (r.file === ctx.curFile && r.start < idx && idx < r.end && (!best || r.start > best.start)) best = r;
      if (best) return best.name;
      // 클래스 밖에서 정의한 멤버 함수: Type Name::func(...) {
      const before = ctx.files[ctx.curFile].stripped.slice(0, idx);
      const m = /\b([A-Za-z_]\w*)::~?[A-Za-z_]\w*\s*\([^;{}]*\)\s*(?:const\s*)?\{[^]*$/.exec(before.slice(-4000));
      return m && structs[m[1]] ? m[1] : null;
    }

    function typeOfName(name, depth) {
      if (name === 'this') { const s = enclosingStruct(ctx.curIdx); return s ? { name: s, args: [], ptr: 1, arr: 0 } : null; }
      const cur = ctx.files[ctx.curFile].stripped;
      let t = declIn(cur, name, 0, ctx.curIdx, true, depth);
      if (!t) {
        const s = enclosingStruct(ctx.curIdx);
        if (s) { const mt = memberOf({ name: s, args: [], ptr: 0, arr: 0 }, name, false); if (mt) return mt; }
      }
      if (!t) for (let fi = 0; fi < ctx.files.length && !t; fi++) if (fi !== ctx.curFile) t = declIn(ctx.files[fi].stripped, name, 0, Infinity, false, depth);
      if (!t) t = declIn(cur, name, ctx.curIdx, Infinity, false, depth);
      return t;
    }

    function findMember(sname, name, seen) {
      const st = structs[sname];
      if (!st) return null;
      const m = st.members.find(x => x.name === name);
      if (m) return m;
      seen = seen || new Set([sname]);
      for (const b of st.bases || []) { const bt = parseType(b); if (bt && !seen.has(bt.name)) { seen.add(bt.name); const r = findMember(bt.name, name, seen); if (r) return r; } }
      return null;
    }

    function retType(code, owner) {
      if (code === 'T0') return clone(owner.args[0]) || null;
      if (code === 'T1') return clone(owner.args[1]) || null;
      if (code === 'T0*') { const t = clone(owner.args[0]); if (t) t.ptr++; return t; }
      if (code === '@it') return { name: '@iter', args: [], ptr: 0, arr: 0, of: owner };
      if (code === '@ins') {
        const it = { name: '@iter', args: [], ptr: 0, arr: 0, of: owner };
        return /^multi/.test(owner.name) ? it : { name: 'pair', args: [it, { name: 'bool', args: [], ptr: 0, arr: 0 }], ptr: 0, arr: 0 };
      }
      return parseType(code);
    }

    function memberOf(t, name, isCall) {
      t = resolveAlias(t);
      if (!t) return null;
      if (t.name === 'pair') {
        if (name === 'first') return clone(t.args[0]);
        if (name === 'second') return clone(t.args[1]);
        return null;
      }
      const table = STL[t.name];
      if (table) {
        const e = table.find(x => x[0] === name);
        return e ? retType(e[2], t) : null;
      }
      const m = findMember(t.name, name);
      if (!m) return null;
      const r = parseType(m.type);
      if (r && m.kind === 'field') r.arr = m.dims || 0;
      return r;
    }

    function elementOf(t) {
      t = resolveAlias(t);
      if (!t) return null;
      if (t.arr > 0) { const r = clone(t); r.arr--; return r; }
      if (t.ptr > 0) { const r = clone(t); r.ptr--; return r; }
      if (t.name === '@iter') return iterElem(t.of);
      if (MAP_LIKE.has(t.name)) return { name: 'pair', args: [clone(t.args[0]), clone(t.args[1])], ptr: 0, arr: 0 };
      if (t.name === 'string') return { name: 'char', args: [], ptr: 0, arr: 0 };
      if (t.name === 'bitset') return { name: 'bool', args: [], ptr: 0, arr: 0 };
      if (t.args && t.args[0]) return clone(t.args[0]);
      return null;
    }
    function indexOf(t) {
      t = resolveAlias(t);
      if (!t) return null;
      if (t.arr > 0 || t.ptr > 0) return elementOf(t);
      if (MAP_LIKE.has(t.name)) return clone(t.args[1]);
      return elementOf(t);
    }
    function iterElem(c) {
      if (!c) return null;
      c = resolveAlias(c);
      if (MAP_LIKE.has(c.name)) return { name: 'pair', args: [clone(c.args[0]), clone(c.args[1])], ptr: 0, arr: 0 };
      if (c.name === 'string') return { name: 'char', args: [], ptr: 0, arr: 0 };
      return c.args && c.args[0] ? clone(c.args[0]) : null;
    }
    function deref(t) {
      t = resolveAlias(t);
      if (!t) return null;
      if (t.ptr > 0) { const r = clone(t); r.ptr--; return r; }
      if (t.name === '@iter') return iterElem(t.of);
      return t; // 포인터가 아닌데 -> 를 쓴 경우에도 멤버는 보여 줌
    }

    // 식 앞부분(체인)을 따라가며 형식 계산
    function resolveChain(s, depth) {
      s = s.trim();
      let p = 0, t = null;
      const ws = () => { while (p < s.length && /\s/.test(s[p])) p++; };
      ws();
      if (s[p] === '(') {
        const cl = matchForward(s, p); if (cl < 0) return null;
        t = resolveExpr(s.slice(p + 1, cl), depth);
        p = cl + 1;
      } else {
        const m = /^(?:::)?[A-Za-z_]\w*(?:::[A-Za-z_]\w*)*/.exec(s.slice(p));
        if (!m) return null;
        const id = m[0].replace(/^::/, '').replace(/^std::/, '');
        p += m[0].length;
        ws();
        if (s[p] === '(' && (isTypeWord(id) && (structs[id] || KNOWN_TEMPL.has(id)))) {
          // 생성자 호출 Node(...) / pair<int,int>(...)
          t = parseType(id); const cl = matchForward(s, p); if (cl < 0) return null; p = cl + 1;
        } else if (s[p] === '<' && KNOWN_TEMPL.has(id)) {
          const cl = matchForward(s, p); if (cl < 0) return null;
          t = parseType(s.slice(0, cl + 1)); p = cl + 1; ws();
          if (s[p] === '(' || s[p] === '{') { const c2 = matchForward(s, p); p = c2 < 0 ? s.length : c2 + 1; }
        } else {
          const nm = id.split('::').pop();
          t = typeOfName(nm, depth);
          if (s[p] === '(') { const cl = matchForward(s, p); if (cl < 0) return null; p = cl + 1; } // 함수 호출 → 반환 형식
        }
      }
      while (t && p < s.length) {
        ws();
        if (p >= s.length) break;
        if (s[p] === '[') { const cl = matchForward(s, p); if (cl < 0) return null; t = indexOf(t); p = cl + 1; continue; }
        let arrow = false;
        if (s[p] === '.') p++;
        else if (s[p] === '-' && s[p + 1] === '>') { p += 2; arrow = true; }
        else if (s[p] === ':' && s[p + 1] === ':') { p += 2; }
        else return null;
        ws();
        const m = /^[A-Za-z_]\w*/.exec(s.slice(p));
        if (!m) return null;
        p += m[0].length; ws();
        const isCall = s[p] === '(';
        const base = arrow ? deref(t) : resolveAlias(t);
        t = memberOf(base && base.ptr > 0 && !arrow ? deref(base) : base, m[0], isCall);
        if (isCall) { const cl = matchForward(s, p); if (cl < 0) return null; p = cl + 1; }
      }
      return t;
    }

    function resolveExpr(expr, depth, atIdx) {
      if (depth < 0) return null;
      let s = expr.trim();
      if (!s) return null;
      let derefs = 0, addr = 0;
      while (s[0] === '*' || s[0] === '&') { if (s[0] === '*') derefs++; else addr++; s = s.slice(1).trim(); }
      let t;
      const nw = /^new\s+([\s\S]+?)\s*(\[.*\]|\(.*\))?\s*$/.exec(s);
      if (nw) { t = parseType(nw[1]); if (t) t.ptr++; }
      else if (/^make_pair\s*\(/.test(s)) t = { name: 'pair', args: [], ptr: 0, arr: 0 };
      else t = resolveChain(s, depth);
      for (let k = 0; k < derefs && t; k++) t = deref(t);
      if (t && addr) { t = clone(t); t.ptr += addr; }
      return t;
    }

    return { resolveChain, deref, resolveAlias, memberOf, findMember, typeOfName };
  }

  // 커서 앞의 체인 식 잘라내기 (끝 = '.' 또는 '->' 바로 앞)
  function chainBefore(text, end) {
    let i = end;
    const wsBack = () => { while (i > 0 && /\s/.test(text[i - 1])) i--; };
    for (let guard = 0; guard < 50; guard++) {
      wsBack();
      const c = text[i - 1];
      if (c === ']' || c === ')') { const o = matchBack(text, i - 1); if (o < 0) return null; i = o; continue; }
      if (c && /\w/.test(c)) {
        while (i > 0 && /\w/.test(text[i - 1])) i--;
        let j = i; while (j > 0 && /\s/.test(text[j - 1])) j--;
        if (text[j - 1] === '.' && text[j - 2] !== '.') { i = j - 1; continue; }
        if (text[j - 1] === '>' && text[j - 2] === '-') { i = j - 2; continue; }
        if (text[j - 1] === ':' && text[j - 2] === ':') { i = j - 2; continue; }
        break;
      }
      if (c === '(' || !c) break;
      // 괄호 그룹으로 시작한 경우 앞에 * 등이 붙을 수 있음
      break;
    }
    const s = text.slice(i, end);
    if (!s.trim() || /^\s*\d/.test(s)) return null;
    // (*it). 처럼 괄호 그룹 바로 앞의 * 는 괄호 안에 있으므로 그대로 둠
    return s;
  }

  // ---------- 자동완성 목록 ----------
  function memberItems(t, R, arrow) {
    let base = arrow ? R.deref(t) : R.resolveAlias(t);
    if (base && base.ptr > 0 && !arrow) base = R.deref(base); // . 를 포인터에 쓴 경우에도 보여 줌
    if (!base || base.arr > 0) return [];
    base = R.resolveAlias(base);
    const items = [];
    if (base.name === 'pair') {
      PAIR_FIELDS.forEach(([n, , r, d]) => items.push({ name: n, kind: 'field', type: typeLabel(r === 'T0' ? base.args[0] : base.args[1]), doc: d }));
      return items;
    }
    const table = STL[base.name];
    if (table) {
      const seen = new Set();
      for (const [n, params, ret, doc] of table) {
        if (seen.has(n)) continue; seen.add(n);
        const rt = ret === 'T0' ? typeLabel(base.args[0]) : ret === 'T1' ? typeLabel(base.args[1]) : ret === 'T0*' ? typeLabel(base.args[0]) + '*' : ret === '@it' ? 'iterator' : ret === '@ins' ? (/^multi/.test(base.name) ? 'iterator' : 'pair<iterator, bool>') : ret;
        items.push({ name: n, kind: 'method', params: params.replace(/^\(|\)$/g, ''), type: rt, doc });
      }
      return items;
    }
    const collect = (sname, seen) => {
      const st = R && R._structs[sname];
      if (!st) return;
      for (const m of st.members) if (!items.some(x => x.name === m.name)) {
        items.push({ name: m.name, kind: m.kind, params: m.params, type: m.kind === 'field' ? m.type + '[]'.repeat(m.dims || 0) : m.type });
      }
      for (const b of st.bases || []) { const bt = parseType(b); if (bt && !seen.has(bt.name)) { seen.add(bt.name); collect(bt.name, seen); } }
    };
    collect(base.name, new Set([base.name]));
    return items;
  }

  function wordItems(files, prefix, curWordFull) {
    const freq = new Map();
    for (const f of files) {
      const re = /[A-Za-z_]\w*/g; let m;
      while ((m = re.exec(f.stripped))) freq.set(m[0], (freq.get(m[0]) || 0) + 1);
    }
    for (const w of KEYWORDS.concat(STD_WORDS)) if (!freq.has(w)) freq.set(w, 0);
    const lp = prefix.toLowerCase();
    const out = [];
    for (const [w, n] of freq) {
      if (w === prefix || w === curWordFull) continue;
      if (w.length <= prefix.length) continue;
      if (!w.toLowerCase().startsWith(lp)) continue;
      if (n === 1 && w === curWordFull) continue;
      out.push({ name: w, kind: KEYWORDS.includes(w) ? 'keyword' : 'word', n });
    }
    out.sort((a, b) => (b.name.startsWith(prefix) - a.name.startsWith(prefix)) || (b.n > 0) - (a.n > 0) || a.name.length - b.name.length || a.name.localeCompare(b.name));
    return out.slice(0, 40);
  }

  // ---------- CodeMirror 연결 ----------
  function attach(cm, opts) {
    // opts: { getFiles(): [{name, code}], getCurrentIndex(), isEnabled(), wordsEnabled(), isCLike() }
    function buildContext() {
      const raw = opts.getFiles();
      const files = raw.map(f => ({ name: f.name, stripped: /\.(c|cc|cpp|cxx|h|hpp|hh)$/i.test(f.name) ? strip(f.code) : '' }));
      const curFile = opts.getCurrentIndex();
      files[curFile].stripped = strip(cm.getValue());
      const info = analyze(files);
      return { files, curFile, info };
    }

    function hint(cmi, options) {
      const manual = options && options.manual;
      const cur = cmi.getCursor();
      const line = cmi.getLine(cur.line);
      let ws = cur.ch;
      while (ws > 0 && /\w/.test(line[ws - 1])) ws--;
      let we = cur.ch;
      while (we < line.length && /\w/.test(line[we])) we++;
      const prefix = line.slice(ws, cur.ch);
      const wordFull = line.slice(ws, we);
      const ctx = buildContext();
      const startIdx = cmi.indexFromPos(CodeMirror.Pos(cur.line, ws));
      const text = ctx.files[ctx.curFile].stripped;
      // 문자열·주석 안이면 중단
      if (prefix && text.slice(startIdx, startIdx + prefix.length) !== prefix) return null;

      let k = startIdx; while (k > 0 && (text[k - 1] === ' ' || text[k - 1] === '\t')) k--;
      let trigger = null;
      if (text[k - 1] === '.' && !/\d/.test(text[k - 2] || '')) trigger = { end: k - 1, arrow: false };
      else if (text[k - 1] === '>' && text[k - 2] === '-') trigger = { end: k - 2, arrow: true };

      let items;
      if (trigger) {
        const chain = chainBefore(text, trigger.end);
        if (!chain) return null;
        ctx.curIdx = trigger.end;
        const R = Resolver(ctx);
        R._structs = ctx.info.structs;
        let t = null;
        try { t = R.resolveChain(chain, 4); } catch (e) { t = null; }
        if (!t) return null;
        items = memberItems(t, R, trigger.arrow);
        const lp = prefix.toLowerCase();
        items = items.filter(it => it.name.toLowerCase().startsWith(lp))
          .concat(items.filter(it => !it.name.toLowerCase().startsWith(lp) && lp && it.name.toLowerCase().includes(lp)));
        items.forEach(it => it.member = true);
        items.typeName = typeLabel(trigger.arrow ? R.deref(t) : t);
      } else {
        if (!opts.wordsEnabled() && !manual) return null;
        if (prefix.length < (manual ? 1 : 2)) return null;
        if (/^\d/.test(prefix)) return null;
        items = wordItems(ctx.files, prefix, wordFull);
      }
      if (!items.length) return null;
      const list = items.map(it => ({
        text: it.name,
        displayText: it.name,
        item: it,
        render: (el) => {
          const name = document.createElement('span'); name.className = 'h-name'; name.textContent = it.name;
          const kind = document.createElement('span'); kind.className = 'h-kind h-' + it.kind;
          kind.textContent = it.kind === 'method' ? 'f' : it.kind === 'field' ? 'v' : it.kind === 'keyword' ? 'k' : '·';
          el.append(kind, name);
          if (it.kind === 'method') { const p = document.createElement('span'); p.className = 'h-params'; p.textContent = '(' + (it.params || '') + ')'; el.append(p); }
          if (it.type) { const ty = document.createElement('span'); ty.className = 'h-type'; ty.textContent = it.type; el.append(ty); }
          if (it.doc) { const d = document.createElement('span'); d.className = 'h-doc'; d.textContent = it.doc; el.append(d); }
        },
        hint: (cmx, data, completion) => {
          const from = data.from, to = CodeMirror.Pos(data.to.line, Math.max(data.to.ch, we));
          if (it.kind === 'method') {
            const after = cmx.getRange(to, CodeMirror.Pos(to.line, to.ch + 1));
            if (after === '(') { cmx.replaceRange(it.name, from, to); return; }
            cmx.replaceRange(it.name + '()', from, to);
            const hasParams = it.params && it.params.trim() && it.params.trim() !== 'void';
            cmx.setCursor(CodeMirror.Pos(from.line, from.ch + it.name.length + (hasParams ? 1 : 2)));
          } else cmx.replaceRange(it.name, from, to);
          cmx.focus();
        },
      }));
      return { list, from: CodeMirror.Pos(cur.line, ws), to: CodeMirror.Pos(cur.line, cur.ch) };
    }

    const hintOpts = {
      hint, completeSingle: false, alignWithWord: true,
      closeCharacters: /[\s()\[\]{};:,=+*\/!&|<?%^"'\\]/,
      container: null,
    };
    function show(manual) {
      if (!opts.isEnabled() || !opts.isCLike()) return;
      cm.showHint(Object.assign({}, hintOpts, { hint: (c) => hint(c, { manual }) }));
    }
    cm.on('inputRead', (c, change) => {
      if (!opts.isEnabled() || !opts.isCLike()) return;
      if (change.origin === 'paste' || change.origin === 'undo') return;
      const ch = change.text.join('\n');
      if (!ch || ch.length > 2) return;
      const last = ch[ch.length - 1];
      if (c.state.completionActive) return;
      const cur = c.getCursor();
      const prev = c.getRange(CodeMirror.Pos(cur.line, Math.max(0, cur.ch - 2)), cur);
      if (last === '.' || prev === '->') show(false);
      else if (/\w/.test(last) && opts.wordsEnabled()) show(false);
    });
    return { show: () => show(true) };
  }

  window.ProComplete = { attach, _test: { strip, analyze, parseType, Resolver, chainBefore, typeLabel, memberItems } };
})();
