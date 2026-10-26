import {
  AppWindow,
  BadgeCheck,
  BookOpen,
  Cake,
  Camera,
  Film,
  HandHeart,
  Image as ImageIcon,
  Layers,
  Megaphone,
  MessageCircleQuestion,
  Monitor,
  Music,
  PanelBottom,
  Presentation,
  Timer,
  Type,
  Wallpaper,
  type LucideIcon,
} from "lucide-react";

// One icon per kind of Content, for the Services and Meeting cards (design audit DD-17). Kinds are the program's
// (scripture, announcement, pdf...) and the Meeting Form's (text, powerpoint...).
const ICONS: Record<string, LucideIcon> = {
  scripture: BookOpen,
  question: MessageCircleQuestion,
  announcement: Megaphone,
  text: Type,
  prayer: HandHeart,
  lowerthird: PanelBottom,
  countdown: Timer,
  birthday: Cake,
  brand: BadgeCheck,
  camera: Camera,
  screen: Monitor,
  window: AppWindow,
  image: ImageIcon,
  video: Film,
  pdf: Presentation,
  powerpoint: Presentation,
  audio: Music,
  background: Wallpaper,
};

export function KindIcon({ kind }: { kind: string }) {
  const Icon = ICONS[kind] ?? Layers;
  return <Icon aria-hidden="true" className="content-icon" size={15} strokeWidth={1.9} />;
}
