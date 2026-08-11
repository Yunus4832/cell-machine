(() => {
  // DOM helpers and the complete 4-bit instruction table.
  const $ = (id) => document.getElementById(id);
  const symbols = "><+-=[]():;PD@,.";
  const known = new Set(symbols);
  const opcodeBySymbol = new Map([...symbols].map((op, code) => [op, code]));
  // Examples are grouped by the memory capacity of the target machine.
  const standardPresets = {
    Hello: `# 输出 Hello, Cell!\n>80\n=48 .00 =65 .00 =6C .00 =6C .00 =6F .00\n=2C .00 =20 .00 =43 .00 =65 .00 =6C .00 =6C .00 =21 .00 =0A .00\n:*`,
    "永久 yes": `# 永久输出 yes\n>80\n=79 .00 =65 .00 =73 .00 =0A .00\n;01`,
    "交互 yes/no": `# 在输入队列中输入 y 或其他字符\n>80\n=3F .00 =20 .00\n,00 (05\n-79 (10\n=6E .00 =6F .00 =0A .00 ;01\n=79 .00 =65 .00 =73 .00 =0A .00 ;01`,
    Collatz: `# 从27开始的 Collatz 轨道，输出到端口01\n>80 =1B\n.01\n-01 (0B -01\n>01 +01 <01\n(15 ;03\n>01 [ -01 <01 +06 >01 ] <01 +04 ;02\n>01 [ -01 <01 +01 >01 ] <01 ;02`,
    动态代码: `# 在数据区生成当前机器字宽度下的 ;10\n>80 =00\n+* +* +* +* +* +* +* +* +* +* +1A\nD01 @01\n+00\n=44 .00 =59 .00 =4E .00 =41 .00 =4D .00 =49 .00 =43 .00 =0A .00\n:*`,
    调用与返回: `# P 保存返回地址，@ 完成调用和返回\n>81 =20 <01\nP +02 @01\n>10\n=52 .00 =45 .00 =54 .00 =55 .00 =52 .00 =4E .00 =0A .00 :*\n+00 +00 +00 +00 +00 +00 +00 +00 +00 +00\n>10\n=43 .00 =41 .00 =4C .00 =4C .00 =0A .00\n<10 @`,
    括号语法糖: `# [] 相对回填：从3倒数到0，并输出3、2、1\n>80 =03\n[\n  .01 -01\n]\n# () 绝对回填：当前值已经为0，所以直接越过循环体\n(\n  =FF .01\n)\n:*`,
  };
  function compactPresets() {
    const model = `CM-4+${addressBits}`;
    const loopToTwo = hex(addressMask - 2);
    const loopToOne = hex(addressMask - 5);
    return {
      端口计数器: `# ${model}：从端口1持续输出递增数值\n>* =0\n.1 +1 :${loopToTwo}`,
      倒计时: `# ${model}：向端口1反复输出最大值到1\n>* =*\n[ .1 -1 ]\n:${loopToOne}`,
      端口回声: `# ${model}：读取端口1并写到端口2\n>*\n,1 .2 :${loopToTwo}`,
      绝对条件跳转: `# ${model}：零值使 ( 跳过最大值赋值，最后输出1\n>* =0\n(4 =*\n=1 .1 :*`,
      括号语法糖: `# ${model}：编译器为 [] 回填相对偏移\n>* =3\n[ .1 -1 ]\n# 完成后使用位宽无关的固定点自旋\n:*`,
    };
  }

  function presetsForModel() {
    if (addressBits <= 6) return compactPresets();
    const dataBase = 2 ** (addressBits - 1);
    const base = hex(dataBase);
    const basePlusOne = hex(dataBase + 1);
    return Object.fromEntries(
      Object.entries(standardPresets).map(([name, source]) => [
        name,
        source
          .replaceAll(">80", `>${base}`)
          .replaceAll(">81", `>${basePlusOne}`)
          .replaceAll("=FF", `=${hex(addressMask)}`),
      ]),
    );
  }
  // Configurable model properties.
  let addressBits = 8;
  let wordBits = 12;
  let addressMask = 0xff;
  let wordMask = 0xfff;
  let addressDigits = 2;
  let wordDigits = 3;

  // Architectural state.
  let mem = new Uint32Array(256);
  let ports = new Uint32Array(256);
  let pp = 0;
  let dp = 0;

  // Simulator and UI state. These are not visible to a Cell Machine program.
  let steps = 0;
  let codeLength = 0;
  let memoryPage = 0;
  let faulted = false;
  let timer = null;
  let lastTick = 0;
  let rateWindowStart = 0;
  let rateWindowSteps = 0;
  let measuredIps = 0;

  // Machine-word encoding helpers.
  const hex = (n, w = addressDigits) =>
    (n >>> 0).toString(16).toUpperCase().padStart(w, "0").slice(-w);
  const opOf = (w) => (w >>> addressBits) & 0xf,
    argOf = (w) => w & addressMask;
  const word = (op, n) =>
    (opcodeBySymbol.get(op) * 2 ** addressBits + (n & addressMask)) & wordMask;

  function refreshPresets() {
    const presets = presetsForModel(),
      select = $("preset"),
      previous = select.value;
    select.innerHTML = "";
    Object.keys(presets).forEach((name) => select.add(new Option(name, name)));
    select.value = Object.hasOwn(presets, previous)
      ? previous
      : Object.keys(presets)[0];
    $("source").value = presets[select.value];
  }

  function configureMachine() {
    addressBits = Number($("addressBits").value);
    wordBits = addressBits + 4;
    addressMask = 2 ** addressBits - 1;
    wordMask = 2 ** wordBits - 1;
    addressDigits = Math.ceil(addressBits / 4);
    wordDigits = Math.ceil(wordBits / 4);
    mem = new Uint32Array(2 ** addressBits);
    ports = new Uint32Array(2 ** addressBits);
    memoryPage = 0;
    $("modelSummary").textContent =
      `4-bit opcode · A=${addressBits} · ${mem.length}×${wordBits} memory`;
    $("ioSummary").textContent =
      `端口 ${hex(0)} 字符流 · 其余端口${wordBits}位数值`;
    $("memorySummary").textContent = `点击单元可修改完整${wordBits}位机器字`;
    $("portAddr").maxLength = addressDigits;
    $("portValue").maxLength = wordDigits;
    $("portAddr").value = hex(1);
    $("portValue").value = hex(0, wordDigits);
    refreshPresets();
  }

  // Source compiler: tokenize symbols, fill defaults, then resolve bracket sugar.
  function tokenize(src) {
    const out = [];
    let i = 0;
    while (i < src.length) {
      const c = src[i];
      if (c === "#") {
        while (i < src.length && src[i] !== "\n") i++;
        continue;
      }
      if (!known.has(c)) {
        i++;
        continue;
      }
      const t = { op: c, arg: null },
        at = i;
      i++;
      while (i < src.length && (src[i] === " " || src[i] === "\t")) i++;
      const save = i;
      if (src[i] === "*") {
        t.arg = addressMask;
        i++;
      } else {
        if (src.slice(i, i + 2).toLowerCase() === "0x") i += 2;
        const m = /^[0-9a-fA-F]+/.exec(src.slice(i));
        if (!m) {
          i = save;
          out.push(t);
          continue;
        }
        if (m[0].length > addressDigits)
          throw new Error(
            `位置 ${at} 的 ${c} 参数超过 ${addressDigits} 位十六进制数`,
          );
        t.arg = parseInt(m[0], 16);
        if (t.arg > addressMask)
          throw new Error(
            `位置 ${at} 的 ${c} 参数 ${m[0]} 超过 ${addressBits} 位 operand 范围`,
          );
        i += m[0].length;
      }
      out.push(t);
    }
    if (out.length > mem.length)
      throw new Error(`程序有 ${out.length} 条指令，超过${mem.length}条上限`);
    return out;
  }
  function assemble(src) {
    const ts = tokenize(src),
      stack = [];
    ts.forEach((t, a) => {
      if (t.arg !== null) return; // 显式参数指令完整独立，不参与括号配对
      if (t.op === "[" || t.op === "(") {
        stack.push({ addr: a, type: t.op });
        return;
      }
      if (t.op === "]" || t.op === ")") {
        const expected = t.op === "]" ? "[" : "(";
        if (!stack.length)
          throw new Error(
            `${hex(a)} 的无参数 ${t.op} 没有对应的无参数 ${expected}`,
          );
        const e = stack.pop();
        if (e.type !== expected)
          throw new Error(
            `${hex(a)} 的无参数 ${t.op} 与 ${hex(e.addr)} 的无参数 ${e.type} 类型不匹配`,
          );
        if (t.op === "]") {
          ts[e.addr].arg = (a - e.addr) & addressMask;
          t.arg = (e.addr - a) & addressMask;
        } else {
          ts[e.addr].arg = (a + 1) & addressMask;
          t.arg = (e.addr + 1) & addressMask;
        }
        return;
      }
      t.arg = "><+-".includes(t.op) ? 1 : 0;
    });
    if (stack.length) {
      const e = stack.pop();
      throw new Error(`${hex(e.addr)} 的无参数 ${e.type} 未闭合`);
    }
    return ts;
  }
  function compile() {
    stop();
    mem.fill(0);
    pp = dp = steps = codeLength = 0;
    memoryPage = 0;
    faulted = false;
    try {
      const ts = assemble($("source").value);
      ts.forEach((t, i) => (mem[i] = word(t.op, t.arg)));
      codeLength = ts.length;
      $("charOut").textContent = "";
      $("log").textContent = "";
      note(
        `已编译 ${ts.length} 条指令 · CM-4+${addressBits} · ${wordBits}位机器字`,
        true,
      );
    } catch (e) {
      faulted = true;
      note(e.message, false);
    }
    render();
  }

  // Execute exactly one complete instruction.
  function execute(update = true) {
    if (faulted) return;
    const w = mem[pp];
    pp = (pp + 1) & addressMask;
    const op = opOf(w),
      n = argOf(w),
      cur = () => mem[dp],
      at = () => (dp + n) & addressMask;
    switch (op) {
      case 0:
        dp = (dp + n) & addressMask;
        break;
      case 1:
        dp = (dp - n) & addressMask;
        break;
      case 2:
        mem[dp] = (cur() + n) & wordMask;
        break;
      case 3:
        mem[dp] = (cur() - n) & wordMask;
        break;
      case 4:
        mem[dp] = n;
        break;
      case 5:
        if (cur() === 0) pp = (pp + n) & addressMask;
        break;
      case 6:
        if (cur() !== 0) pp = (pp + n) & addressMask;
        break;
      case 7:
        if (cur() === 0) pp = n;
        break;
      case 8:
        if (cur() !== 0) pp = n;
        break;
      case 9:
        pp = (pp + n) & addressMask;
        break;
      case 10:
        pp = n;
        break;
      case 11:
        mem[at()] = pp;
        break;
      case 12:
        mem[at()] = dp;
        break;
      case 13:
        pp = mem[at()] & addressMask;
        break;
      case 14:
        if (n === 0) {
          const q = $("inputQueue");
          mem[dp] = q.value.length ? q.value.charCodeAt(0) & wordMask : 0;
          q.value = q.value.slice(1);
        } else mem[dp] = ports[n];
        break;
      case 15:
        ports[n] = cur();
        if (n === 0)
          $("charOut").textContent += String.fromCharCode(cur() & 255);
        else log(`${hex(steps, 6)} OUT[${hex(n)}] ← ${hex(cur(), wordDigits)}`);
        break;
    }
    steps++;
    if (update) render();
  }
  const formatRate = (n) =>
    n >= 1024
      ? `${(n / 1024).toFixed(n >= 10240 ? 0 : 1).replace(".0", "")}Ki`
      : `${Math.round(n)}`;
  function run() {
    if (faulted) return;
    stop();
    lastTick = rateWindowStart = performance.now();
    rateWindowSteps = steps;
    measuredIps = 0;
    timer = setInterval(() => {
      const now = performance.now(),
        ips = Number($("clockHz").value),
        due = Math.floor(((now - lastTick) * ips) / 1000);
      if (due >= 1) {
        const count = Math.min(due, 10000);
        lastTick += (count * 1000) / ips;
        for (let i = 0; i < count; i++) execute(false);
      }
      if (now - rateWindowStart >= 500) {
        measuredIps =
          ((steps - rateWindowSteps) * 1000) / (now - rateWindowStart);
        rateWindowStart = now;
        rateWindowSteps = steps;
        render();
      }
    }, 16);
    render();
  }
  function stop() {
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
    measuredIps = 0;
    render();
  }
  function note(s, ok) {
    $("message").textContent = s;
    $("message").className = ok ? "ok" : "error";
  }
  function log(s) {
    const e = $("log");
    e.textContent += (e.textContent ? "\n" : "") + s;
    e.scrollTop = e.scrollHeight;
  }

  // Render only host-side state; rendering never changes architectural state.
  function render() {
    $("pp").textContent = hex(pp);
    $("dp").textContent = hex(dp);
    $("current").textContent = hex(mem[dp], wordDigits);
    $("steps").textContent = steps;
    const ips = Number($("clockHz").value);
    $("state").textContent = faulted
      ? "ERROR"
      : timer
        ? `RUN ${formatRate(ips)} / ${formatRate(measuredIps)} IPS`
        : "PAUSE";
    const root = $("memory");
    root.innerHTML = "";
    const pageSize = Math.min(256, mem.length),
      pages = Math.ceil(mem.length / pageSize);
    root.classList.toggle("full-page", pageSize === 256);
    memoryPage = Math.max(0, Math.min(memoryPage, pages - 1));
    const start = memoryPage * pageSize,
      end = Math.min(start + pageSize, mem.length);
    $("pageLabel").textContent =
      `${hex(start)}–${hex(end - 1)} / ${mem.length} Cell`;
    $("prevPage").disabled = memoryPage === 0;
    $("nextPage").disabled = memoryPage === pages - 1;
    for (let i = start; i < end; i++) {
      const d = document.createElement("div"),
        op = opOf(mem[i]),
        n = argOf(mem[i]),
        symbol = symbols[op];
      d.className =
        "cell" +
        (i === pp ? " pp" : "") +
        (i === dp ? " dp" : "") +
        (i < codeLength ? " code" : "");
      d.innerHTML = `<small>${hex(i)}</small>${symbol}${hex(n)}`;
      d.title = `${hex(i)}: ${hex(mem[i], wordDigits)} (${symbol} ${hex(n)})`;
      d.onclick = () => {
        const v = prompt(`memory[${hex(i)}]：`, hex(mem[i], wordDigits));
        if (
          v !== null &&
          new RegExp(`^[0-9a-fA-F]{1,${wordDigits}}$`).test(v.trim())
        ) {
          mem[i] = parseInt(v, 16) & wordMask;
          render();
        }
      };
      root.appendChild(d);
    }
  }
  function bindEvents() {
    $("preset").onchange = () => {
      const presets = presetsForModel();
      $("source").value = presets[$("preset").value];
      compile();
    };
    $("addressBits").onchange = () => {
      stop();
      configureMachine();
      compile();
    };
    $("compile").onclick = compile;
    $("step").onclick = () => {
      stop();
      execute();
    };
    $("run").onclick = run;
    $("pause").onclick = stop;
    $("clockHz").onchange = () => (timer ? run() : render());
    $("clear").onclick = () => {
      stop();
      mem.fill(0);
      pp = dp = steps = codeLength = 0;
      faulted = false;
      note("内存已清空", true);
      render();
    };
    $("prevPage").onclick = () => {
      memoryPage--;
      render();
    };
    $("nextPage").onclick = () => {
      memoryPage++;
      render();
    };
    $("setPort").onclick = () => {
      const address = parseInt($("portAddr").value, 16);
      const value = parseInt($("portValue").value, 16);
      const valid =
        Number.isFinite(address) &&
        Number.isFinite(value) &&
        address <= addressMask &&
        value <= wordMask;

      if (!valid) {
        note("端口地址或数值超出当前机器规格", false);
        return;
      }

      ports[address] = value;
      log(`HOST PORT[${hex(address)}] ← ${hex(value, wordDigits)}`);
    };
  }

  bindEvents();
  configureMachine();
  compile();
})();
