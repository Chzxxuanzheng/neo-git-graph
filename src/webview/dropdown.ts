import { escapeHtml } from "./utils/html";
import { svgIcons } from "./utils/icons";

interface DropdownOption {
  name: string;
  value: string;
}

abstract class AbstractDropdown {
  protected options: DropdownOption[] = [];
  protected dropdownVisible: boolean = false;
  protected showInfo: boolean;

  protected elem: HTMLElement;
  protected currentValueElem: HTMLDivElement;
  protected menuElem: HTMLDivElement;
  protected optionsElem: HTMLDivElement;
  protected noResultsElem: HTMLDivElement;
  protected filterInput: HTMLInputElement;

  constructor(id: string, showInfo: boolean, dropdownType: string) {
    this.showInfo = showInfo;
    this.elem = document.getElementById(id)!;

    let filter = document.createElement("div");
    filter.className = "dropdownFilter";
    this.filterInput = document.createElement("input");
    this.filterInput.className = "dropdownFilterInput";
    this.filterInput.placeholder = l10n.filterPlaceholder.replace("{0}", dropdownType);
    filter.appendChild(this.filterInput);
    this.menuElem = document.createElement("div");
    this.menuElem.className = "dropdownMenu";
    this.menuElem.appendChild(filter);
    this.optionsElem = document.createElement("div");
    this.optionsElem.className = "dropdownOptions";
    this.menuElem.appendChild(this.optionsElem);
    this.noResultsElem = document.createElement("div");
    this.noResultsElem.className = "dropdownNoResults";
    this.noResultsElem.innerHTML = l10n.noResultsFound;
    this.menuElem.appendChild(this.noResultsElem);
    this.currentValueElem = document.createElement("div");
    this.currentValueElem.className = "dropdownCurrentValue";
    this.elem.appendChild(this.currentValueElem);
    this.elem.appendChild(this.menuElem);

    document.addEventListener(
      "click",
      (e) => {
        if (!e.target) return;
        if (e.target === this.currentValueElem) {
          this.dropdownVisible = !this.dropdownVisible;
          if (this.dropdownVisible) {
            this.filterInput.value = "";
            this.onFilterChange();
          }
          this.elem.classList.toggle("dropdownOpen");
          if (this.dropdownVisible) this.filterInput.focus();
        } else if (this.dropdownVisible) {
          if ((<HTMLElement>e.target).closest(".dropdown") !== this.elem) {
            this.close();
          } else {
            this.handleOptionClick(e.target as HTMLElement);
          }
        }
      },
      true
    );
    document.addEventListener("contextmenu", () => this.close(), true);
    document.addEventListener(
      "keyup",
      (e) => {
        if (e.key === "Escape") this.close();
      },
      true
    );
    this.filterInput.addEventListener("keyup", () => this.onFilterChange());
  }

  protected handleOptionClick(target: HTMLElement) {
    let option = <HTMLElement | null>target.closest(".dropdownOption");
    if (
      option !== null &&
      option.parentNode === this.optionsElem &&
      typeof option.dataset.id !== "undefined"
    ) {
      this.onOptionSelected(parseInt(option.dataset.id!));
    }
  }

  protected abstract onOptionSelected(index: number): void;
  protected abstract render(): void;
  protected abstract onFilterChange(): void;

  public abstract setOptions(options: DropdownOption[], ...args: unknown[]): void;

  public refresh() {
    if (this.options.length > 0) this.render();
  }

  protected filter() {
    let val = this.filterInput.value.toLowerCase(),
      match,
      matches = false;
    for (let i = 0; i < this.options.length; i++) {
      match = this.options[i].name.toLowerCase().indexOf(val) > -1;
      (<HTMLElement>this.optionsElem.children[i]).style.display = match ? "block" : "none";
      if (match) matches = true;
    }
    this.filterInput.style.display = "block";
    this.noResultsElem.style.display = matches ? "none" : "block";
  }

  protected close() {
    this.elem.classList.remove("dropdownOpen");
    this.dropdownVisible = false;
  }

  protected updateCurrentValueWidth() {
    this.currentValueElem.style.width =
      Math.max(
        this.menuElem.offsetWidth + (this.showInfo && this.menuElem.offsetHeight < 272 ? 0 : 12),
        130
      ) + "px";
  }
}

export class Dropdown extends AbstractDropdown {
  private selectedOption: number = 0;
  private changeCallback: { (value: string): void };

  constructor(
    id: string,
    showInfo: boolean,
    dropdownType: string,
    changeCallback: { (value: string): void }
  ) {
    super(id, showInfo, dropdownType);
    this.changeCallback = changeCallback;
  }

  public setOptions(options: DropdownOption[], selected: string) {
    this.options = options;
    let selectedOption = 0;
    for (let i = 0; i < options.length; i++) {
      if (options[i].value === selected) {
        selectedOption = i;
      }
    }
    this.selectedOption = selectedOption;
    if (options.length <= 1) this.close();
    this.render();
  }

  protected onOptionSelected(index: number): void {
    this.close();
    if (this.selectedOption !== index) {
      this.selectedOption = index;
      this.render();
      this.changeCallback(this.options[this.selectedOption].value);
    }
  }

  protected render() {
    this.elem.classList.add("loaded");
    this.currentValueElem.innerHTML = escapeHtml(this.options[this.selectedOption].name);
    let html = "";
    for (let i = 0; i < this.options.length; i++) {
      html +=
        '<div class="dropdownOption' +
        (this.selectedOption === i ? " selected" : "") +
        '" data-id="' +
        i +
        '">' +
        escapeHtml(this.options[i].name) +
        (this.showInfo
          ? '<div class="dropdownOptionInfo" title="' +
            escapeHtml(this.options[i].value) +
            '">' +
            svgIcons.info +
            "</div>"
          : "") +
        "</div>";
    }
    this.optionsElem.className = "dropdownOptions" + (this.showInfo ? " showInfo" : "");
    this.optionsElem.innerHTML = html;
    this.filterInput.style.display = "none";
    this.noResultsElem.style.display = "none";
    this.menuElem.style.cssText = "opacity:0; display:block;";
    // Width must be at least 130px for the filter elements. Max height for the dropdown is [filter (31px) + 9.5 * dropdown item (28px) = 297px]
    // Don't need to add 12px if showing info icons and scrollbar isn't needed. The scrollbar isn't needed if: menuElem height + filter input (25px) < 297px
    this.updateCurrentValueWidth();
    this.menuElem.style.cssText = "right:0; overflow-y:auto; max-height:297px;";
    if (this.dropdownVisible) this.filter();
  }

  protected onFilterChange() {
    this.filter();
  }
}

export class CheckboxDropdown extends AbstractDropdown {
  private selectedOptions: Set<string> = new Set();
  private multipleChangeCallback: { (values: string[], change: string): void };

  constructor(
    id: string,
    showInfo: boolean,
    dropdownType: string,
    changeCallback: { (values: string[], change: string): void }
  ) {
    super(id, showInfo, dropdownType);
    this.multipleChangeCallback = changeCallback;
  }

  public setOptions(options: DropdownOption[], selectedValues: string[]) {
    this.options = options;
    this.selectedOptions.clear();
    for (const value of selectedValues) {
      this.selectedOptions.add(value);
    }
    if (options.length <= 1) this.close();
    this.render();
  }

  public setSelected(value: string) {
    if (!this.options.some((i) => i.value === value))
      throw new Error(
        `unknown option: "${value}", available options: ${this.options.map((i) => `"${i.value}"`).join(", ")}`
      );
    this.selectedOptions.add(value);
    this.render();
  }

  public setUnSelected(value: string) {
    if (!this.options.some((i) => i.value === value))
      throw new Error(
        `unknown option: "${value}", available options: ${this.options.map((i) => `"${i.value}"`).join(", ")}`
      );
    this.selectedOptions.delete(value);
    this.render();
  }

  protected onOptionSelected(index: number): void {
    const value = this.options[index].value;
    if (this.selectedOptions.has(value)) {
      this.selectedOptions.delete(value);
    } else {
      this.selectedOptions.add(value);
    }
    this.render();
    this.emitChange(value);
  }

  protected render() {
    this.elem.classList.add("loaded");

    const selectedNames = this.options
      .filter((i) => this.selectedOptions.has(i.value))
      .map((i) => i.name)
      .join(" & ");
    this.currentValueElem.innerHTML = escapeHtml(selectedNames);

    let html = "";
    for (const [i, option] of Object.entries(this.options)) {
      const isSelected = this.selectedOptions.has(option.value);
      html +=
        '<div class="dropdownOption' +
        (isSelected ? " selected" : "") +
        '" data-id="' +
        i +
        '"><input type="checkbox" class="dropdownCheckbox" ' +
        (isSelected ? "checked" : "") +
        "/> " +
        escapeHtml(option.name) +
        (this.showInfo
          ? '<div class="dropdownOptionInfo" title="' +
            escapeHtml(option.value) +
            '">' +
            svgIcons.info +
            "</div>"
          : "") +
        "</div>";
    }
    this.optionsElem.className = "dropdownOptions" + (this.showInfo ? " showInfo" : "");
    this.optionsElem.innerHTML = html;
    this.filterInput.style.display = "none";
    this.noResultsElem.style.display = "none";
    this.menuElem.style.cssText = "opacity:0; display:block;";
    this.updateCurrentValueWidth();
    this.menuElem.style.cssText = "right:0; overflow-y:auto; max-height:297px;";

    if (this.dropdownVisible) this.filterCheckboxes();
  }

  protected onFilterChange() {
    this.filterCheckboxes();
  }

  private filterCheckboxes() {
    const val = this.filterInput.value.toLowerCase();
    let matches = false;
    for (let i = 0; i < this.options.length; i++) {
      const match = this.options[i].name.toLowerCase().indexOf(val) > -1;
      (this.optionsElem.children[i] as HTMLElement).style.display = match ? "block" : "none";
      if (match) matches = true;
    }
    this.filterInput.style.display = "block";
    this.noResultsElem.style.display = matches ? "none" : "block";
  }

  private emitChange(change: string) {
    this.multipleChangeCallback(Array.from(this.selectedOptions), change);
  }
}
