const App = (() => {
  const STORAGE_KEY = "adflow_local_v6";
  const STATUS_KEYS = ["final", "review", "print", "reply", "publish", "endDate"];
  const MAIN_CHECKLIST = [
    { key: "final", label: "進檔" },
    { key: "review", label: "送審" },
    { key: "print", label: "發包" },
    { key: "reply", label: "回簽" },
    { key: "publish", label: "見刊" },
    { key: "endDate", label: "下刊" }
  ];

  const CHECKLIST_CONFIG = {
    燈片: {
      importDefaults: ["款式確認"],
      review: ["明細 PDF", "檢核表", "圖稿 JPG", "切結書"]
    },
    長廊: {
      importDefaults: ["線稿格數"],
      review: ["企劃書", "檢核表", "函", "送審明細", "切結書"]
    },
    創意街道: {
      importDefaults: [
        "線稿-天花板",
        "線稿-背面屋頂",
        "線稿-壁貼",
        "線稿-側板包框",
        "線稿-獨立直式包框"
      ],
      review: ["企劃書", "檢核表", "函", "送審明細", "切結書", "其他資料"]
    }
  };

  const state = {
    schedules: [],
    currentChecklistIndex: null,
    completedVisible: false,
    editingId: null
  };

  const el = {};

  function init() {
    cacheElements();
    bindEvents();
    load();
    render();
    setTimeout(checkReminders, 350);
  }

  function cacheElements() {
    const ids = [
      "sidebar",
      "search-client",
      "start-date",
      "end-date",
      "schedule-table-body",
      "completed-table-body",
      "empty-state",
      "completed-section",
      "toggle-history-btn",
      "stat-total",
      "stat-pending",
      "stat-completed",
      "add-modal",
      "checklist-modal",
      "today-reminder-modal",
      "toast",
      "toast-msg",
      "import-file",
      "modal-client",
      "modal-type",
      "modal-publish",
      "modal-end",
      "checklist-project-title",
      "checklist-content",
      "today-tasks-list",
      "no-tasks-msg",
      "backup-btn",
      "import-btn",
      "excel-btn",
      "reminder-btn",
      "toggle-sidebar-btn",
      "mobile-toggle-btn",
      "clear-filters-btn",
      "open-add-modal-btn",
      "close-add-modal-btn",
      "confirm-add-btn",
      "close-checklist-modal-btn",
      "checklist-close-btn",
      "close-reminder-modal-btn",
      "placement-list",
      "add-placement-btn",
      "project-modal-title"
    ];

    ids.forEach((id) => {
      el[id] = document.getElementById(id);
    });
  }

  function bindEvents() {
    el["search-client"].addEventListener("input", render);
    el["start-date"].addEventListener("change", render);
    el["end-date"].addEventListener("change", render);

    el["schedule-table-body"].addEventListener("input", handleTableInput);
    el["schedule-table-body"].addEventListener("change", handleTableChange);
    el["schedule-table-body"].addEventListener("click", handleTableClick);
    el["completed-table-body"].addEventListener("click", handleCompletedClick);
    el["checklist-content"].addEventListener("change", handleChecklistChange);

    el["backup-btn"].addEventListener("click", backupData);
    el["import-btn"].addEventListener("click", () => el["import-file"].click());
    el["import-file"].addEventListener("change", (e) => handleFileImport(e.target));
    el["excel-btn"].addEventListener("click", downloadExcel);
    el["reminder-btn"].addEventListener("click", openTodayReminderModal);
    el["toggle-sidebar-btn"].addEventListener("click", toggleSidebar);
    el["mobile-toggle-btn"].addEventListener("click", () => {
      el["sidebar"].classList.toggle("active");
    });
    el["clear-filters-btn"].addEventListener("click", clearFilters);
    el["open-add-modal-btn"].addEventListener("click", openAddModal);
    el["toggle-history-btn"].addEventListener("click", toggleCompletedTable);
    el["close-add-modal-btn"].addEventListener("click", closeAddModal);
    el["confirm-add-btn"].addEventListener("click", saveProjectFromModal);
    el["close-checklist-modal-btn"].addEventListener("click", closeChecklistModal);
    el["checklist-close-btn"].addEventListener("click", closeChecklistModal);
    el["close-reminder-modal-btn"].addEventListener("click", closeTodayReminderModal);
    el["add-placement-btn"].addEventListener("click", () => addPlacementRow());

    el["placement-list"].addEventListener("click", (event) => {
      const btn = event.target.closest("[data-action='remove-placement']");
      if (!btn) return;

      const rows = el["placement-list"].querySelectorAll(".placement-row");
      if (rows.length <= 1) {
        showToast("至少保留一列版位 / 款式", "error");
        return;
      }

      btn.closest(".placement-row")?.remove();
    });

    [el["add-modal"], el["checklist-modal"], el["today-reminder-modal"]].forEach((modal) => {
      modal.addEventListener("click", (event) => {
        if (event.target === modal) {
          modal.classList.remove("open");
          if (modal === el["checklist-modal"]) state.currentChecklistIndex = null;
          if (modal === el["add-modal"]) state.editingId = null;
        }
      });
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        closeAddModal();
        closeChecklistModal();
        closeTodayReminderModal();
      }
    });
  }

  function load() {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      state.schedules = [];
      return;
    }

    try {
      const parsed = JSON.parse(raw);

      if (Array.isArray(parsed)) {
        state.schedules = parsed.map(normalizeSchedule);
      } else if (parsed && Array.isArray(parsed.schedules)) {
        state.schedules = parsed.schedules.map(normalizeSchedule);
      } else {
        state.schedules = [];
      }
    } catch (error) {
      console.error("讀取資料失敗:", error);
      state.schedules = [];
      showToast("資料讀取失敗，已重設為空白", "error");
    }
  }

  function persist() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state.schedules));
  }

  function normalizePlacements(item = {}) {
    if (Array.isArray(item.placements)) {
      return item.placements
        .map((row) => ({
          style: String(row?.style || "").trim(),
          position: String(row?.position || "").trim()
        }))
        .filter((row) => row.style || row.position);
    }

    const legacyStyle = String(item.style || "").trim();
    const legacyPositions = normalizePositions(item.positions);

    if (legacyStyle || legacyPositions.length) {
      if (legacyPositions.length === 0) {
        return [{ style: legacyStyle, position: "" }];
      }

      return legacyPositions.map((position) => ({
        style: legacyStyle,
        position
      }));
    }

    return [];
  }

  function normalizePositions(value) {
    if (Array.isArray(value)) {
      return value
        .map((item) => String(item).trim())
        .filter(Boolean);
    }

    if (typeof value === "string") {
      return value
        .split(/\r?\n|,|，|;|；|、/g)
        .map((item) => item.trim())
        .filter(Boolean);
    }

    return [];
  }

  function placementsToText(placements) {
    return placements
      .map((row) => {
        const style = String(row.style || "").trim();
        const position = String(row.position || "").trim();

        if (style && position) return `${style}｜${position}`;
        if (position) return position;
        if (style) return style;
        return "";
      })
      .filter(Boolean)
      .join("、");
  }

  function normalizeSchedule(item = {}) {
    const status = STATUS_KEYS.reduce((acc, key) => {
      acc[key] = Boolean(item.status?.[key]);
      return acc;
    }, {});

    return {
      id: item.id || createId(),
      name: item.name || "",
      type: item.type || "燈片",
      placements: normalizePlacements(item),
      publish: item.publish || "",
      endDate: item.endDate || "",
      final: item.final || "",
      review: item.review || "",
      print: item.print || "",
      note: item.note || "",
      status,
      details: { ...(item.details || {}) }
    };
  }

  function createId() {
    return `p_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  }

  function formatDate(date) {
    if (!(date instanceof Date) || Number.isNaN(date.getTime())) return "";
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }

  function parseDateString(value) {
    if (!value) return null;
    const [y, m, d] = value.split("-").map(Number);
    if (!y || !m || !d) return null;
    return new Date(y, m - 1, d);
  }

  function shiftDate(dateString, days) {
    const date = parseDateString(dateString);
    if (!date) return "";
    date.setDate(date.getDate() + days);
    return formatDate(date);
  }

  function getTodayString() {
    return formatDate(new Date());
  }

  function getDiffDays(targetString) {
    const target = parseDateString(targetString);
    if (!target) return null;
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    return Math.ceil((target - today) / 86400000);
  }

  function calculateDates(publish, type) {
    if (!publish) return { final: "", review: "", print: "" };

    return {
      final: shiftDate(publish, type === "創意街道" ? -30 : -14),
      review: shiftDate(publish, -7),
      print: shiftDate(publish, -7)
    };
  }

  function getProgress(item) {
    const done = STATUS_KEYS.filter((key) => item.status[key]).length;
    const total = STATUS_KEYS.length;

    return {
      done,
      total,
      percent: Math.round((done / total) * 100),
      isComplete: done === total
    };
  }

  function getFilters() {
    return {
      keyword: el["search-client"].value.trim().toLowerCase(),
      startDate: el["start-date"].value,
      endDate: el["end-date"].value
    };
  }

  function isScheduleVisible(item, filters) {
    const placementsText = placementsToText(item.placements);
    const haystack = `${item.name} ${item.type} ${item.note} ${placementsText}`.toLowerCase();
    const matchesKeyword = !filters.keyword || haystack.includes(filters.keyword);
    const matchesStart = !filters.startDate || (item.publish && item.publish >= filters.startDate);
    const matchesEnd = !filters.endDate || (item.publish && item.publish <= filters.endDate);
    return matchesKeyword && matchesStart && matchesEnd;
  }

  function getDateClass(dateValue, statusDone) {
    if (!dateValue || statusDone) return "";
    const diffDays = getDiffDays(dateValue);
    if (diffDays === null) return "";
    if (diffDays < 0) return "overdue";
    if (diffDays <= 2) return "warning";
    return "";
  }

  function escapeHtml(value = "") {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function sortByPublishAsc(list) {
    return [...list].sort((a, b) => {
      const aDate = parseDateString(a.publish);
      const bDate = parseDateString(b.publish);

      if (!aDate && !bDate) return 0;
      if (!aDate) return 1;
      if (!bDate) return -1;

      return aDate - bDate;
    });
  }

  function sortByPublishDesc(list) {
    return [...list].sort((a, b) => {
      const aDate = parseDateString(a.publish);
      const bDate = parseDateString(b.publish);

      if (!aDate && !bDate) return 0;
      if (!aDate) return 1;
      if (!bDate) return -1;

      return bDate - aDate;
    });
  }

  function render() {
    const filters = getFilters();
    const activeRows = [];
    const completedRows = [];

    let visibleCount = 0;

    const activeList = [];
    const completedList = [];

    state.schedules.forEach((item) => {
      const progress = getProgress(item);
      if (progress.isComplete) {
        completedList.push(item);
      } else {
        activeList.push(item);
      }
    });

    const sortedActiveList = sortByPublishAsc(activeList);
    const sortedCompletedList = sortByPublishDesc(completedList);

    sortedActiveList.forEach((item) => {
      if (!isScheduleVisible(item, filters)) return;
      visibleCount += 1;
      activeRows.push(createActiveRow(item, getProgress(item)));
    });

    sortedCompletedList.forEach((item) => {
      if (!isScheduleVisible(item, filters)) return;
      completedRows.push(createCompletedRow(item));
    });

    el["schedule-table-body"].innerHTML = activeRows.join("");
    el["completed-table-body"].innerHTML = completedRows.join("");
    el["empty-state"].style.display = visibleCount === 0 ? "block" : "none";
    el["completed-section"].style.display = state.completedVisible ? "block" : "none";

    el["toggle-history-btn"].innerHTML = state.completedVisible
      ? '<i class="fas fa-chevron-up"></i> 收起已完成專案'
      : '<i class="fas fa-history"></i> 查看已完成專案';

    el["stat-total"].textContent = String(state.schedules.length);
    el["stat-pending"].textContent = String(activeList.length);
    el["stat-completed"].textContent = String(completedList.length);
  }

  function createActiveRow(item, progress) {
    return `
      <tr>
        <td class="sticky-col-cell">
          <div class="project-cell">
            <div class="project-name">${escapeHtml(item.name || "未命名專案")}</div>
            <div class="project-type">${escapeHtml(item.type || "未填類別")}</div>
            <div class="progress-container">
              <div class="progress-bar-bg">
                <div class="progress-bar-fill" style="width:${progress.percent}%;"></div>
              </div>
              <div class="progress-text">
                <span>${progress.done}/${progress.total} 完成</span>
                <button class="btn btn-secondary" data-action="open-checklist" data-id="${item.id}" style="padding:2px 8px; font-size:11px;">
                  檢核表
                </button>
              </div>
            </div>
          </div>
        </td>
        <td>${escapeHtml(item.type)}</td>
        ${createDateCell(item.id, "final", item.final, item.status.final)}
        ${createDateCell(item.id, "review", item.review, item.status.review)}
        ${createDateCell(item.id, "print", item.print, item.status.print)}
        ${createDateCell(item.id, "publish", item.publish, item.status.publish)}
        ${createDateCell(item.id, "endDate", item.endDate, item.status.endDate)}
        ${createStatusCell(item.id, "reply", item.status.reply)}
        ${createStatusCell(item.id, "review", item.status.review)}
        ${createStatusCell(item.id, "print", item.status.print)}
        <td>
          <input
            class="seamless-input"
            data-action="text-change"
            data-id="${item.id}"
            data-key="note"
            value="${escapeHtml(item.note)}"
            placeholder="輸入備註"
          />
        </td>
        <td class="table-center">
          <button class="btn-icon" data-action="edit" data-id="${item.id}" title="編輯">
            <i class="fas fa-pen"></i>
          </button>
          <button class="btn-icon" data-action="delete" data-id="${item.id}" title="刪除">
            <i class="fas fa-trash"></i>
          </button>
        </td>
      </tr>
    `;
  }

  function createCompletedRow(item) {
    return `
      <tr>
        <td class="sticky-col-cell"><strong>${escapeHtml(item.name || "未命名專案")}</strong></td>
        <td>${escapeHtml(item.type || "-")}</td>
        <td>
          <input
            type="date"
            class="seamless-input ${getDateClass(item.publish, item.status.publish)}"
            data-action="date-change"
            data-id="${item.id}"
            data-key="publish"
            value="${escapeHtml(item.publish || "")}"
          />
        </td>
        <td>
          <input
            type="date"
            class="seamless-input ${getDateClass(item.endDate, item.status.endDate)}"
            data-action="date-change"
            data-id="${item.id}"
            data-key="endDate"
            value="${escapeHtml(item.endDate || "")}"
          />
        </td>
        <td>
          <input
            class="seamless-input"
            data-action="text-change"
            data-id="${item.id}"
            data-key="note"
            value="${escapeHtml(item.note)}"
            placeholder="輸入備註"
          />
        </td>
        <td class="table-center">
          <button class="btn-icon" data-action="open-checklist" data-id="${item.id}" title="檢核表">
            <i class="fas fa-clipboard-check"></i>
          </button>
          <button class="btn-icon" data-action="edit" data-id="${item.id}" title="編輯">
            <i class="fas fa-pen"></i>
          </button>
        </td>
      </tr>
    `;
  }

  function createDateCell(id, key, value, statusDone) {
    return `
      <td>
        <input
          type="date"
          class="seamless-input ${getDateClass(value, statusDone)}"
          data-action="date-change"
          data-id="${id}"
          data-key="${key}"
          value="${escapeHtml(value || "")}"
        />
      </td>
    `;
  }

  function createStatusCell(id, key, active) {
    return `
      <td class="table-center">
        <button
          class="status-toggle ${active ? "active" : ""}"
          data-action="toggle-status"
          data-id="${id}"
          data-key="${key}"
          type="button"
        >
          <i class="fas fa-check"></i>
        </button>
      </td>
    `;
  }

  function findScheduleById(id) {
    return state.schedules.find((item) => item.id === id);
  }

  function updateScheduleById(id, updater) {
    const target = findScheduleById(id);
    if (!target) return;
    updater(target);
    persist();
    render();
  }

  function handleTableInput(event) {
    const target = event.target;
    if (target.dataset.action === "text-change") {
      const id = target.dataset.id;
      const key = target.dataset.key;
      const row = findScheduleById(id);
      if (!row) return;
      row[key] = target.value;
      persist();
    }
  }

  function handleTableChange(event) {
    const target = event.target;
    if (target.dataset.action === "date-change") {
      const id = target.dataset.id;
      const key = target.dataset.key;
      updateScheduleById(id, (item) => {
        item[key] = target.value;
      });
    }
  }

  function handleTableClick(event) {
    const actionEl = event.target.closest("[data-action]");
    if (!actionEl) return;

    const action = actionEl.dataset.action;
    const id = actionEl.dataset.id;
    const key = actionEl.dataset.key;

    if (action === "toggle-status") {
      updateScheduleById(id, (item) => {
        item.status[key] = !item.status[key];
      });
      return;
    }

    if (action === "open-checklist") {
      openChecklist(id);
      return;
    }

    if (action === "edit") {
      openEditModal(id);
      return;
    }

    if (action === "delete") {
      deleteSchedule(id);
    }
  }

  function handleCompletedClick(event) {
    const actionEl = event.target.closest("[data-action]");
    if (!actionEl) return;

    const action = actionEl.dataset.action;
    const id = actionEl.dataset.id;

    if (action === "open-checklist") {
      openChecklist(id);
      return;
    }

    if (action === "edit") {
      openEditModal(id);
    }
  }

  function collectReminders() {
    const rules = [
      { key: "final", label: "進檔", daysBefore: 3 },
      { key: "review", label: "送審", daysBefore: 2 },
      { key: "print", label: "發包", daysBefore: 0 },
      { key: "publish", label: "見刊", daysBefore: 0 },
      { key: "endDate", label: "下刊", daysBefore: 0 }
    ];

    const reminders = [];

    state.schedules.forEach((item) => {
      if (getProgress(item).isComplete) return;

      rules.forEach((rule) => {
        if (item.status[rule.key] || !item[rule.key]) return;

        const diffDays = getDiffDays(item[rule.key]);
        if (diffDays === null || diffDays > rule.daysBefore) return;

        let text = `${rule.label} 剩 ${diffDays} 天`;

        if (diffDays < 0) {
          text = `${rule.label} 已逾期 ${Math.abs(diffDays)} 天`;
        } else if (diffDays === 0) {
          text = `${rule.label} 今天到期`;
        }

        reminders.push({
          id: item.id,
          client: item.name,
          text,
          date: item[rule.key]
        });
      });
    });

    return reminders.sort((a, b) => a.date.localeCompare(b.date));
  }

  function renderReminderList() {
    const reminders = collectReminders();
    const list = el["today-tasks-list"];
    list.innerHTML = "";

    if (!reminders.length) {
      el["no-tasks-msg"].style.display = "block";
      return;
    }

    el["no-tasks-msg"].style.display = "none";

    reminders.forEach((reminder) => {
      const li = document.createElement("li");
      li.className = "reminder-item";
      li.innerHTML = `
        <div>
          <strong>${escapeHtml(reminder.client)}</strong><br>
          <span style="font-size:12px; color:var(--text-sub);">${escapeHtml(reminder.text)}</span>
        </div>
        <button class="btn btn-secondary" style="padding:6px 10px;">查看</button>
      `;
      li.querySelector("button").addEventListener("click", () => {
        closeTodayReminderModal();
        openChecklist(reminder.id);
      });
      list.appendChild(li);
    });
  }

  function checkReminders() {
    renderReminderList();
    const hasAny = collectReminders().length > 0;
    if (hasAny) el["today-reminder-modal"].classList.add("open");
  }

  function openTodayReminderModal() {
    renderReminderList();
    el["today-reminder-modal"].classList.add("open");
  }

  function openChecklist(id) {
    const item = findScheduleById(id);
    if (!item) return;

    state.currentChecklistIndex = state.schedules.findIndex((row) => row.id === id);
    el["checklist-project-title"].textContent = `${item.name}｜${item.type}`;

    const config = CHECKLIST_CONFIG[item.type] || { importDefaults: [], review: [] };
    const html = [];
    const placementsHtml = item.placements.length
      ? item.placements
          .map((row, index) => {
            return `
              <div class="checklist-placement-item">
                <strong>第 ${index + 1} 組</strong><br>
                款式：${escapeHtml(row.style || "-")}<br>
                版位：${escapeHtml(row.position || "-")}
              </div>
            `;
          })
          .join("")
      : `<div class="checklist-placement-item">尚未設定版位 / 款式</div>`;

    html.push(`
      <div class="checklist-group">
        <h4><i class="fas fa-circle-info"></i> 專案資訊</h4>
        <div class="checklist-placement-list">
          ${placementsHtml}
        </div>
      </div>
    `);

    html.push('<div class="checklist-group">');
    html.push('<h4><i class="fas fa-flag-checkered"></i> 主流程</h4>');
    html.push('<div class="progress-grid">');

    MAIN_CHECKLIST.forEach((entry) => {
      const checked = item.status[entry.key] ? "checked" : "";
      const activeClass = item.status[entry.key] ? "active" : "";
      html.push(`
        <div class="progress-card ${activeClass}">
          <input type="checkbox" data-kind="main" data-key="${entry.key}" ${checked} />
          <label>${entry.label}</label>
        </div>
      `);
    });

    html.push("</div></div>");

    if (config.importDefaults.length) {
      html.push(renderChecklistGroup("進檔細項", "importDefaults", config.importDefaults, item.details));
    }

    if (config.review.length) {
      html.push(renderChecklistGroup("送審細項", "review", config.review, item.details));
    }

    el["checklist-content"].innerHTML = html.join("");
    el["checklist-modal"].classList.add("open");
  }

  function renderChecklistGroup(title, prefix, items, detailMap) {
    const parts = [
      `<div class="checklist-group"><h4><i class="fas fa-list-check"></i> ${escapeHtml(title)}</h4>`
    ];

    items.forEach((label, idx) => {
      const key = `${prefix}_${idx}`;
      const checked = detailMap[key] ? "checked" : "";
      parts.push(`
        <div class="check-item">
          <input type="checkbox" data-kind="detail" data-key="${key}" ${checked} />
          <label>${escapeHtml(label)}</label>
        </div>
      `);
    });

    parts.push("</div>");
    return parts.join("");
  }

  function handleChecklistChange(event) {
    const target = event.target;
    if (!target.matches('input[type="checkbox"]')) return;

    const index = state.currentChecklistIndex;
    if (index === null || !state.schedules[index]) return;

    const item = state.schedules[index];
    const kind = target.dataset.kind;
    const key = target.dataset.key;

    if (kind === "main") {
      item.status[key] = target.checked;
    } else if (kind === "detail") {
      item.details[key] = target.checked;
    }

    persist();
    openChecklist(item.id);
    render();
  }

  function addPlacementRow(style = "", position = "") {
    const row = document.createElement("div");
    row.className = "placement-row";
    row.innerHTML = `
      <div class="placement-field">
        <label>款式</label>
        <input
          type="text"
          class="modern-input no-icon placement-style"
          placeholder="例如：橫式"
          value="${escapeHtml(style)}"
        />
      </div>
      <div class="placement-field">
        <label>版位</label>
        <input
          type="text"
          class="modern-input no-icon placement-position"
          placeholder="例如：南京敦化路口(小巨蛋)"
          value="${escapeHtml(position)}"
        />
      </div>
      <button type="button" class="remove-placement-btn" data-action="remove-placement" title="刪除這列">
        <i class="fas fa-trash"></i>
      </button>
    `;
    el["placement-list"].appendChild(row);
  }

  function getPlacementRows() {
    const rows = Array.from(el["placement-list"].querySelectorAll(".placement-row"));
    return rows
      .map((row) => {
        const style = row.querySelector(".placement-style")?.value.trim() || "";
        const position = row.querySelector(".placement-position")?.value.trim() || "";
        return { style, position };
      })
      .filter((row) => row.style || row.position);
  }

  function openAddModal() {
    state.editingId = null;
    el["project-modal-title"].textContent = "新增專案排程";
    el["confirm-add-btn"].textContent = "儲存專案";

    el["modal-client"].value = "";
    el["modal-type"].value = "燈片";
    el["modal-publish"].value = "";
    el["modal-end"].value = "";
    el["placement-list"].innerHTML = "";
    addPlacementRow();

    el["add-modal"].classList.add("open");
  }

  function openEditModal(id) {
    const item = findScheduleById(id);
    if (!item) return;

    state.editingId = id;
    el["project-modal-title"].textContent = "編輯專案";
    el["confirm-add-btn"].textContent = "更新專案";

    el["modal-client"].value = item.name || "";
    el["modal-type"].value = item.type || "燈片";
    el["modal-publish"].value = item.publish || "";
    el["modal-end"].value = item.endDate || "";
    el["placement-list"].innerHTML = "";

    if (item.placements.length) {
      item.placements.forEach((row) => addPlacementRow(row.style, row.position));
    } else {
      addPlacementRow();
    }

    el["add-modal"].classList.add("open");
  }

  function saveProjectFromModal() {
    const form = {
      client: el["modal-client"].value.trim(),
      type: el["modal-type"].value,
      placements: getPlacementRows(),
      publish: el["modal-publish"].value,
      end: el["modal-end"].value
    };

    if (!form.client || !form.publish) {
      showToast("請至少填寫客戶名稱與見刊日", "error");
      return;
    }

    if (!form.placements.length) {
      showToast("請至少新增一組版位 / 款式", "error");
      return;
    }

    if (state.editingId) {
      updateScheduleById(state.editingId, (item) => {
        const dates = calculateDates(form.publish, form.type);
        item.name = form.client;
        item.type = form.type;
        item.placements = form.placements;
        item.publish = form.publish;
        item.endDate = form.end;
        item.final = item.final || dates.final;
        item.review = item.review || dates.review;
        item.print = item.print || dates.print;
      });

      closeAddModal();
      showToast("專案已更新", "success");
      return;
    }

    const dates = calculateDates(form.publish, form.type);
    state.schedules.unshift(
      normalizeSchedule({
        name: form.client,
        type: form.type,
        placements: form.placements,
        publish: form.publish,
        endDate: form.end,
        final: dates.final,
        review: dates.review,
        print: dates.print,
        note: ""
      })
    );

    persist();
    render();
    closeAddModal();
    showToast("專案已新增", "success");
  }

  function closeAddModal() {
    el["add-modal"].classList.remove("open");
    state.editingId = null;
  }

  function deleteSchedule(id) {
    const item = findScheduleById(id);
    if (!item) return;

    const ok = window.confirm(`確定要刪除「${item.name || "未命名專案"}」嗎？`);
    if (!ok) return;

    state.schedules = state.schedules.filter((row) => row.id !== id);
    persist();
    render();
    showToast("專案已刪除", "success");
  }

  function toggleCompletedTable() {
    state.completedVisible = !state.completedVisible;
    render();
  }

  function clearFilters() {
    el["search-client"].value = "";
    el["start-date"].value = "";
    el["end-date"].value = "";
    render();
  }

  function closeChecklistModal() {
    el["checklist-modal"].classList.remove("open");
    state.currentChecklistIndex = null;
  }

  function closeTodayReminderModal() {
    el["today-reminder-modal"].classList.remove("open");
  }

  function toggleSidebar() {
    if (window.innerWidth <= 768) {
      el["sidebar"].classList.toggle("active");
    } else {
      el["sidebar"].classList.toggle("collapsed");
    }
  }

  function showToast(message, type = "info") {
    const toast = el["toast"];
    const icon = toast.querySelector("i");
    el["toast-msg"].textContent = message;
    toast.className = `toast show ${type}`;

    if (type === "success") icon.className = "fas fa-check-circle";
    else if (type === "error") icon.className = "fas fa-exclamation-circle";
    else icon.className = "fas fa-info-circle";

    setTimeout(() => toast.classList.remove("show"), 2500);
  }

  function backupData() {
    const exportData = {
      version: "v6",
      exportedAt: new Date().toISOString(),
      schedules: state.schedules
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], {
      type: "application/json"
    });

    triggerDownload(blob, `adflow-backup-${getTodayString()}.json`);
    showToast("JSON 備份已下載", "success");
  }

  function handleFileImport(input) {
    const [file] = input.files || [];
    if (!file) return;

    const reader = new FileReader();

    reader.onload = () => {
      try {
        const rawText = String(reader.result || "").replace(/^\uFEFF/, "").trim();

        if (!rawText) {
          throw new Error("空白檔案");
        }

        const parsed = JSON.parse(rawText);

        let importedSchedules = [];

        if (Array.isArray(parsed)) {
          importedSchedules = parsed;
        } else if (parsed && Array.isArray(parsed.schedules)) {
          importedSchedules = parsed.schedules;
        } else {
          throw new Error("JSON 格式不正確，找不到排程陣列");
        }

        state.schedules = importedSchedules.map(normalizeSchedule);

        persist();
        render();
        showToast("資料匯入成功", "success");
      } catch (error) {
        console.error("匯入失敗:", error);
        showToast("匯入失敗，請確認 JSON 檔格式正確", "error");
      } finally {
        input.value = "";
      }
    };

    reader.onerror = () => {
      console.error("讀取檔案失敗");
      showToast("讀取檔案失敗", "error");
      input.value = "";
    };

    reader.readAsText(file, "utf-8");
  }

  function downloadExcel() {
    const rows = state.schedules.map((item) => ({
      客戶名稱: item.name,
      類別: item.type,
      款式版位: placementsToText(item.placements),
      進檔日: item.final,
      送審日: item.review,
      發包日: item.print,
      見刊日: item.publish,
      下刊日: item.endDate,
      進檔完成: item.status.final ? "完成" : "未完成",
      送審完成: item.status.review ? "完成" : "未完成",
      發包完成: item.status.print ? "完成" : "未完成",
      回簽完成: item.status.reply ? "完成" : "未完成",
      見刊完成: item.status.publish ? "完成" : "未完成",
      下刊完成: item.status.endDate ? "完成" : "未完成",
      備註: item.note
    }));

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "排程");
    XLSX.writeFile(wb, `adflow-${getTodayString()}.xlsx`);
    showToast("Excel 已匯出", "success");
  }

  function triggerDownload(blob, filename) {
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
  }

  return {
    init
  };
})();

window.addEventListener("DOMContentLoaded", App.init);