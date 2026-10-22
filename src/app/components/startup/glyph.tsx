import {
  Activity, Ban, Battery, Bell, Bike, Book, BookOpen, Bot, Bug, Building, Calendar, Camera, ChartColumn, ChartPie, CircleCheck, Clock, Code, Coins,
  Ear, Eye, Factory, FileCheck, FileText, Fish, Gamepad2, Gauge, GitBranch, Hand, Headphones, Heart, House, Landmark, Leaf, Lock, Map, MapPin, Mic,
  MousePointer, Pen, Percent, Plane, Play, Plug, RefreshCw, Repeat, Scan, Send, Share2, Shield, Shirt, ShoppingCart, SlidersHorizontal, Smartphone,
  Sparkles, Stethoscope, Swords, Target, Timer, TrendingDown, Type, Utensils, Wallet, WandSparkles, WifiOff, Wrench, Zap, type LucideIcon,
} from "lucide-react";

/*
 * Named icons for startup logos without a file and for product features
 * (2026-10-19). Unknown names fall back to a check mark, so a founder's typed
 * feature always draws something.
 */

const ICONS: Record<string, LucideIcon> = {
  sparkles: Sparkles, robot: Bot, bot: Bot, gamepad: Gamepad2, battery: Battery, heart: Heart, code: Code, wallet: Wallet, utensils: Utensils,
  bike: Bike, mic: Mic, headphones: Headphones, eye: Eye, plane: Plane, fish: Fish, leaf: Leaf, shirt: Shirt, send: Send, activity: Activity, ear: Ear,
  pen: Pen, check: CircleCheck, book: BookOpen, notebook: Book, hand: Hand, wand: WandSparkles, gauge: Gauge, swords: Swords, repeat: Repeat,
  wrench: Wrench, "trending-down": TrendingDown, zap: Zap, bell: Bell, stethoscope: Stethoscope, "file-text": FileText, shield: Shield, plug: Plug,
  coins: Coins, landmark: Landmark, target: Target, calendar: Calendar, "shopping-cart": ShoppingCart, "pie-chart": ChartPie, clock: Clock,
  "refresh-cw": RefreshCw, smartphone: Smartphone, lock: Lock, type: Type, scan: Scan, "wifi-off": WifiOff, timer: Timer, map: Map, bug: Bug,
  home: House, ban: Ban, building: Building, factory: Factory, "map-pin": MapPin, "file-check": FileCheck, percent: Percent, "git-branch": GitBranch,
  play: Play, "bar-chart": ChartColumn, sliders: SlidersHorizontal, camera: Camera, "mouse-pointer": MousePointer, share: Share2,
};

export const GLYPH_NAMES = ["sparkles", "robot", "gamepad", "battery", "heart", "code", "wallet", "utensils", "bike", "mic", "headphones", "eye", "plane", "fish", "leaf", "shirt", "send", "activity", "ear", "pen"] as const;

export function Glyph({ name, size = 18, className }: { name: string; size?: number; className?: string }) {
  // Own keys only: a feature typed as "constructor" must not find Object.prototype (2026-10-21).
  const Icon = (Object.hasOwn(ICONS, name) ? ICONS[name] : undefined) ?? CircleCheck;
  return <Icon size={size} className={className} aria-hidden="true" strokeWidth={1.9} />;
}
