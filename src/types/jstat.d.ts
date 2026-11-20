declare module 'jstat' {
  // Minimal typing for the jStat functions used by src/domain/distributions.
  type Fn = (...args: number[]) => number;
  interface Law { pdf: Fn; cdf: Fn; inv: Fn; mean: Fn }
  interface JStat {
    normal: Law; lognormal: Law; beta: Law; gamma: Law; exponential: Law; weibull: Law; uniform: Law; triangular: Law;
    binomial: { pdf: Fn; cdf: Fn };
    lowRegGamma: Fn; ibeta: Fn; gammaln: Fn; gammafn: Fn;
    [k: string]: unknown;
  }
  const jStat: JStat;
  export default jStat;
}
