export type City = {
  id: string;
  name: string;
  district: string;
  latitude: number;
  longitude: number;
};

export const CITIES: readonly City[] = [
  {
    id: "shanghai",
    name: "上海",
    district: "浦东",
    latitude: 31.13,
    longitude: 121.47,
  },
  {
    id: "beijing",
    name: "北京",
    district: "朝阳",
    latitude: 39.92,
    longitude: 116.44,
  },
  {
    id: "guangzhou",
    name: "广州",
    district: "天河",
    latitude: 23.13,
    longitude: 113.36,
  },
  {
    id: "shenzhen",
    name: "深圳",
    district: "福田",
    latitude: 22.54,
    longitude: 114.06,
  },
  {
    id: "chengdu",
    name: "成都",
    district: "锦江",
    latitude: 30.57,
    longitude: 104.08,
  },
  {
    id: "hangzhou",
    name: "杭州",
    district: "西湖",
    latitude: 30.26,
    longitude: 120.13,
  },
  {
    id: "wuhan",
    name: "武汉",
    district: "武昌",
    latitude: 30.58,
    longitude: 114.32,
  },
  {
    id: "xian",
    name: "西安",
    district: "雁塔",
    latitude: 34.23,
    longitude: 108.94,
  },
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
