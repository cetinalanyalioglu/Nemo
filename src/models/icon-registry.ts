import type { IconType } from 'react-icons';
import {
  BsArrowDownCircle,
  BsArrowUpCircle,
  BsArrowUpCircleFill,
  BsArrowLeftRight,
  BsArrowsExpand,
  BsArrowBarRight,
  BsDiagram2,
  BsLightningFill,
  BsFunnelFill,
  BsSlashLg,
  BsFire,
  BsBrightnessHighFill,
  BsDropletFill,
  BsBox,
  BsCircle,
  BsDiamond,
  BsTriangle,
} from 'react-icons/bs';

/**
 * Maps icon names referenced in model definition files to concrete
 * react-icons components. Add new icons here to make them available to models.
 */
const iconRegistry: Record<string, IconType> = {
  BsArrowDownCircle,
  BsArrowUpCircle,
  BsArrowUpCircleFill,
  BsArrowLeftRight,
  BsArrowsExpand,
  BsArrowBarRight,
  BsDiagram2,
  BsLightningFill,
  BsFunnelFill,
  BsSlashLg,
  BsFire,
  BsBrightnessHighFill,
  BsDropletFill,
  BsBox,
  BsCircle,
  BsDiamond,
  BsTriangle,
};

/** Fallback icon used when a model references an unknown icon name. */
export const DEFAULT_NODE_ICON: IconType = BsBox;

/**
 * Resolves an icon name to its component, falling back to a default icon when
 * the name is missing or not registered.
 */
export const resolveIcon = (name?: string): IconType => {
  if (name && iconRegistry[name]) {
    return iconRegistry[name];
  }
  if (name) {
    console.warn(`Icon "${name}" is not registered; using default icon.`);
  }
  return DEFAULT_NODE_ICON;
};

export default iconRegistry;
