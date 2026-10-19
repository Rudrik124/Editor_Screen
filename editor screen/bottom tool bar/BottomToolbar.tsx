import { Icon1 } from "./functionality/icon1/functionality";
import { Icon2 } from "./functionality/icon2/functionality";
import { Icon3 } from "./functionality/icon3/functionality";
import { Icon4 } from "./functionality/icon4/functionality";
import { Icon5 } from "./functionality/icon5/functionality";
import { Icon6 } from "./functionality/icon6/functionality";
import { Icon7 } from "./functionality/icon7/functionality";
import { Icon8 } from "./functionality/icon8/functionality";
import { Icon9 } from "./functionality/icon9/functionality";
import { Icon10 } from "./functionality/icon10/functionality";
import { Icon11 } from "./functionality/icon11/functionality";
import { Icon12 } from "./functionality/icon12/functionality";
import { Icon13 } from "./functionality/icon13/functionality";
import { Icon14 } from "./functionality/icon14/functionality";
import "./bottom-toolbar.css";

const groups = [
  [Icon1, Icon2, Icon3, Icon4, Icon5],
  [Icon6, Icon7],
  [Icon8, Icon9, Icon10, Icon11, Icon12],
  [Icon13, Icon14],
];

export function BottomToolbar() {
  return (
    <nav className="veytrix-bottom-toolbar" aria-label="Editing tools">
      {groups.map((group, groupIndex) => (
        <span className="veytrix-bottom-toolbar__group" key={groupIndex}>
          {group.map((Icon, iconIndex) => <Icon key={iconIndex} />)}
          {groupIndex < groups.length - 1 && <span className="veytrix-bottom-toolbar__separator" aria-hidden="true" />}
        </span>
      ))}
    </nav>
  );
}
