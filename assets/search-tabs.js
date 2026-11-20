let workspaceCount = 0;

function element(tag, className, text) {
  const node = document.createElement(tag);
  node.className = className;
  if (text) node.textContent = text;
  return node;
}

function button(className, text, action) {
  const control = element("button", className, text);
  control.type = "button";
  control.addEventListener("click", action);
  return control;
}

export function renderSearchTabs(target, mountPanel) {
  const workspace = element("div", "search-tab-workspace");
  const toolbar = element("div", "search-tab-toolbar");
  const tabList = element("div", "search-tab-list");
  tabList.setAttribute("role", "tablist");
  tabList.setAttribute("aria-label", "Web Search tabs");
  const newTab = button("search-tab-new", "+", () => addTab(true));
  newTab.setAttribute("aria-label", "New search tab");
  newTab.title = "New search tab";
  const panels = element("div", "search-tab-panels");
  toolbar.append(tabList, newTab);
  workspace.append(toolbar, panels);

  const prefix = `search-tabs-${++workspaceCount}`;
  const tabs = [];
  let count = 0;
  let active;
  let disposed = false;

  function setSelected(tab, selected) {
    tab.activator.setAttribute("aria-selected", String(selected));
    tab.activator.tabIndex = selected ? 0 : -1;
    tab.close.tabIndex = selected ? 0 : -1;
    tab.item.dataset.selected = String(selected);
    tab.panel.hidden = !selected;
  }

  function selectTab(tab, focus) {
    if (active !== tab) {
      if (active) setSelected(active, false);
      active = tab;
      setSelected(tab, true);
    }
    if (focus) {
      tab.activator.focus({ preventScroll: true });
      tab.item.scrollIntoView?.({ block: "nearest", inline: "nearest" });
    }
  }

  function removeTab(tab) {
    try {
      tab.dispose?.();
    } finally {
      tab.item.remove();
      tab.panel.remove();
    }
  }

  function closeTab(tab) {
    const index = tabs.indexOf(tab);
    if (index === -1) return;
    tabs.splice(index, 1);
    if (active === tab) active = undefined;
    try {
      removeTab(tab);
    } finally {
      if (tabs.length) selectTab(active || tabs[Math.min(index, tabs.length - 1)], true);
      else addTab(true);
    }
  }

  function handleTabKey(event, tab) {
    if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    const index = tabs.indexOf(tab);
    let next;
    switch (event.key) {
      case "ArrowLeft": next = tabs[(index + tabs.length - 1) % tabs.length]; break;
      case "ArrowRight": next = tabs[(index + 1) % tabs.length]; break;
      case "Home": next = tabs[0]; break;
      case "End": next = tabs.at(-1); break;
      case "Delete":
        event.preventDefault();
        closeTab(tab);
        return;
      default: return;
    }
    event.preventDefault();
    selectTab(next, true);
  }

  function addTab(focus) {
    if (disposed) return;
    const serial = ++count;
    const id = `${prefix}-${serial}`;
    const item = element("div", "search-tab-item");
    item.setAttribute("role", "presentation");
    const panel = element("div", "search-tab-panel");
    panel.id = `${id}-panel`;
    panel.setAttribute("role", "tabpanel");
    const activator = button("search-tab-activator", "New search", () => selectTab(tab, true));
    activator.id = `${id}-tab`;
    activator.setAttribute("role", "tab");
    activator.setAttribute("aria-controls", panel.id);
    activator.addEventListener("keydown", event => handleTabKey(event, tab));
    panel.setAttribute("aria-labelledby", activator.id);
    const close = button("search-tab-close", "×", () => closeTab(tab));
    const tab = { item, panel, activator, close, dispose: undefined };
    const setTitle = title => {
      const label = typeof title === "string" ? title.trim().replace(/\s+/g, " ").slice(0, 120) : "";
      activator.textContent = label || "New search";
      activator.title = label || `Search tab ${serial}`;
      activator.setAttribute("aria-label", label || `New search, tab ${serial}`);
      close.title = label ? `Close ${label} tab` : `Close search tab ${serial}`;
      close.setAttribute("aria-label", close.title);
    };
    setTitle("");
    item.append(activator, close);
    tabList.append(item);
    panels.append(panel);
    const previous = active;
    tabs.push(tab);
    selectTab(tab, false);
    try {
      const cleanup = mountPanel(panel, { setTitle });
      if (typeof cleanup === "function") tab.dispose = cleanup;
    } catch (error) {
      tabs.pop();
      active = undefined;
      removeTab(tab);
      if (previous) selectTab(previous, focus);
      throw error;
    }
    if (focus) selectTab(tab, true);
  }

  target.append(workspace);
  try {
    addTab(false);
  } catch (error) {
    workspace.remove();
    throw error;
  }

  return () => {
    if (disposed) return;
    disposed = true;
    const errors = [];
    for (const tab of tabs.splice(0)) {
      try {
        removeTab(tab);
      } catch (error) {
        errors.push(error);
      }
    }
    active = undefined;
    workspace.remove();
    if (errors.length) throw new AggregateError(errors, "Could not completely close the search tabs.");
  };
}
