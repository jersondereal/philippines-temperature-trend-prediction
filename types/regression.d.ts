declare module 'regression' {
  export interface Point extends Array<number> {
    0: number;
    1: number;
  }

  export interface Result {
    r2: number;
    equation: number[];
    points: [number, number][];
    string: string;
    predict(x: number): [number, number];
  }

  export interface Options {
    order?: number;
    precision?: number;
  }

  export interface RegressionMethods {
    linear(data: Point[], options?: Options): Result;
    exponential(data: Point[], options?: Options): Result;
    logarithmic(data: Point[], options?: Options): Result;
    power(data: Point[], options?: Options): Result;
    polynomial(data: Point[], options?: Options): Result;
  }

  const regression: RegressionMethods;
  export default regression;
} 