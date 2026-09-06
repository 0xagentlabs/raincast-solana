export type City = {
  id: string;
  name: string;
  district: string;
  region: "国内" | "海外";
  latitude: number;
  longitude: number;
};

export const CITIES: readonly City[] = [
  {
    id: "shanghai",
    name: "上海",
    district: "浦东",
    region: "国内",
    latitude: 31.13,
    longitude: 121.47,
  },
  {
    id: "beijing",
    name: "北京",
    district: "朝阳",
    region: "国内",
    latitude: 39.92,
    longitude: 116.44,
  },
  {
    id: "guangzhou",
    name: "广州",
    district: "天河",
    region: "国内",
    latitude: 23.13,
    longitude: 113.36,
  },
  {
    id: "shenzhen",
    name: "深圳",
    district: "福田",
    region: "国内",
    latitude: 22.54,
    longitude: 114.06,
  },
  {
    id: "chengdu",
    name: "成都",
    district: "锦江",
    region: "国内",
    latitude: 30.57,
    longitude: 104.08,
  },
  {
    id: "hangzhou",
    name: "杭州",
    district: "西湖",
    region: "国内",
    latitude: 30.26,
    longitude: 120.13,
  },
  {
    id: "wuhan",
    name: "武汉",
    district: "武昌",
    region: "国内",
    latitude: 30.58,
    longitude: 114.32,
  },
  {
    id: "xian",
    name: "西安",
    district: "雁塔",
    region: "国内",
    latitude: 34.23,
    longitude: 108.94,
  },
  { id: "chongqing", name: "重庆", district: "渝中", region: "国内", latitude: 29.56, longitude: 106.55 },
  { id: "nanjing", name: "南京", district: "玄武", region: "国内", latitude: 32.06, longitude: 118.80 },
  { id: "suzhou", name: "苏州", district: "姑苏", region: "国内", latitude: 31.30, longitude: 120.62 },
  { id: "qingdao", name: "青岛", district: "市南", region: "国内", latitude: 36.07, longitude: 120.38 },
  { id: "hong-kong", name: "香港", district: "中西区", region: "国内", latitude: 22.28, longitude: 114.16 },
  { id: "taipei", name: "台北", district: "信义", region: "国内", latitude: 25.04, longitude: 121.57 },
  { id: "tokyo", name: "东京", district: "千代田", region: "海外", latitude: 35.68, longitude: 139.76 },
  { id: "seoul", name: "首尔", district: "中区", region: "海外", latitude: 37.57, longitude: 126.98 },
  { id: "singapore", name: "新加坡", district: "市中心", region: "海外", latitude: 1.29, longitude: 103.85 },
  { id: "london", name: "伦敦", district: "威斯敏斯特", region: "海外", latitude: 51.51, longitude: -0.13 },
  { id: "paris", name: "巴黎", district: "市中心", region: "海外", latitude: 48.86, longitude: 2.35 },
  { id: "new-york", name: "纽约", district: "曼哈顿", region: "海外", latitude: 40.71, longitude: -74.01 },
  { id: "san-francisco", name: "旧金山", district: "市中心", region: "海外", latitude: 37.77, longitude: -122.42 },
  { id: "sydney", name: "悉尼", district: "市中心", region: "海外", latitude: -33.87, longitude: 151.21 },
  { id: "dubai", name: "迪拜", district: "市中心", region: "海外", latitude: 25.20, longitude: 55.27 },
  { id: "toronto", name: "多伦多", district: "市中心", region: "海外", latitude: 43.65, longitude: -79.38 },
] as const;

const coordinateKey = (latitude: number, longitude: number) =>
  `${latitude.toFixed(4)},${longitude.toFixed(4)}`;
const citiesByCoordinates = new Map(
  CITIES.map((city) => [coordinateKey(city.latitude, city.longitude), city]),
);

export function cityForCoordinates(
  latitude: number,
  longitude: number,
): City | undefined {
  return citiesByCoordinates.get(coordinateKey(latitude, longitude));
}

export function cityLabel(latitude: number, longitude: number): string {
  const city = cityForCoordinates(latitude, longitude);
  return city
    ? `${city.name} · ${city.district}`
    : `${latitude.toFixed(2)}°, ${longitude.toFixed(2)}°`;
}
