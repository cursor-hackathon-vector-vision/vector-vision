declare module 'squarify' {
  interface Container {
    x0: number;
    y0: number;
    x1: number;
    y1: number;
  }
  
  interface DataItem {
    value: number;
    [key: string]: unknown;
  }
  
  interface LayoutResult extends Container {
    value: number;
    [key: string]: unknown;
  }
  
  function squarify<T extends DataItem>(
    data: T[],
    container: Container
  ): (T & Container)[];
  
  export default squarify;
}
