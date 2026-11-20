import type { Kind } from './laws';

/** Equivalent R and Python snippets for every family and experiment. */
type Fields = (number | string)[];
const v = (f: Fields, i: number) => String(f[i]);

const R: Partial<Record<Kind, (f: Fields) => [string, string]>> = {
  normal: (f) => [`rnorm(n, mean = ${v(f, 0)}, sd = ${v(f, 1)})`, `dnorm(x, mean = ${v(f, 0)}, sd = ${v(f, 1)})`],
  lognormal: (f) => [`rlnorm(n, meanlog = ${v(f, 0)}, sdlog = ${v(f, 1)})`, `dlnorm(x, meanlog = ${v(f, 0)}, sdlog = ${v(f, 1)})`],
  exponential: (f) => [`rexp(n, rate = ${v(f, 0)})`, `dexp(x, rate = ${v(f, 0)})`],
  gamma: (f) => [`rgamma(n, shape = ${v(f, 0)}, scale = ${v(f, 1)})`, `dgamma(x, shape = ${v(f, 0)}, scale = ${v(f, 1)})`],
  weibull: (f) => [`rweibull(n, shape = ${v(f, 0)}, scale = ${v(f, 1)})`, `dweibull(x, shape = ${v(f, 0)}, scale = ${v(f, 1)})`],
  beta: (f) => [`rbeta(n, ${v(f, 0)}, ${v(f, 1)})`, `dbeta(x, ${v(f, 0)}, ${v(f, 1)})`],
  uniform: (f) => [`runif(n, min = ${v(f, 0)}, max = ${v(f, 1)})`, `dunif(x, min = ${v(f, 0)}, max = ${v(f, 1)})`],
  logistic: (f) => [`rlogis(n, location = ${v(f, 0)}, scale = ${v(f, 1)})`, `dlogis(x, location = ${v(f, 0)}, scale = ${v(f, 1)})`],
  cauchy: (f) => [`rcauchy(n, location = ${v(f, 0)}, scale = ${v(f, 1)})`, `dcauchy(x, location = ${v(f, 0)}, scale = ${v(f, 1)})`],
  triangular: (f) => [`library(triangle)\nrtriangle(n, a = ${v(f, 0)}, b = ${v(f, 2)}, c = ${v(f, 1)})`, `dtriangle(x, a = ${v(f, 0)}, b = ${v(f, 2)}, c = ${v(f, 1)})`],
  poisson: (f) => [`rpois(n, lambda = ${v(f, 0)})`, `dpois(x, lambda = ${v(f, 0)})`],
  binomial: (f) => [`rbinom(n, size = ${v(f, 0)}, prob = ${v(f, 1)})`, `dbinom(x, size = ${v(f, 0)}, prob = ${v(f, 1)})`],
  geometric: (f) => [`rgeom(n, prob = ${v(f, 0)})`, `dgeom(x, prob = ${v(f, 0)})`],
  negbinomial: (f) => [`rnbinom(n, size = ${v(f, 0)}, prob = ${v(f, 1)})`, `dnbinom(x, size = ${v(f, 0)}, prob = ${v(f, 1)})`],
  hypergeometric: (f) => [`rhyper(n, m = ${v(f, 1)}, n = ${Number(f[0]) - Number(f[1])}, k = ${v(f, 2)})`, `dhyper(x, m = ${v(f, 1)}, n = ${Number(f[0]) - Number(f[1])}, k = ${v(f, 2)})`],
  bernoulli: (f) => [`rbinom(n, size = 1, prob = ${v(f, 0)})`, `dbinom(x, size = 1, prob = ${v(f, 0)})`],
  discrete: (f) => [`sample(${v(f, 0)}:${v(f, 1)}, n, replace = TRUE)`, `ifelse(x %in% ${v(f, 0)}:${v(f, 1)}, 1 / (${v(f, 1)} - ${v(f, 0)} + 1), 0)`],
  categorical: (f) => [`p <- c(${v(f, 0)})\nsample(seq_along(p), n, replace = TRUE, prob = p)`, `p[x]`],
  empirical: (f) => [`obs <- c(${v(f, 0)})\nsample(obs, n, replace = TRUE)`, `table(obs)[as.character(x)] / length(obs)`],
  truncated: (f) => [`library(truncnorm)\nrtruncnorm(n, a = ${v(f, 2)}, b = ${v(f, 3)}, mean = ${v(f, 0)}, sd = ${v(f, 1)})`, `dtruncnorm(x, a = ${v(f, 2)}, b = ${v(f, 3)}, mean = ${v(f, 0)}, sd = ${v(f, 1)})`],
  minextreme: (f) => [`${v(f, 0)} + ${v(f, 1)} * log(-log(runif(n)))`, `exp((x - ${v(f, 0)}) / ${v(f, 1)} - exp((x - ${v(f, 0)}) / ${v(f, 1)})) / ${v(f, 1)}`],
  constant: (f) => [`rep(${v(f, 0)}, n)`, `as.numeric(x == ${v(f, 0)})`],
};

const PY: Partial<Record<Kind, (f: Fields) => string>> = {
  normal: (f) => `norm(loc=${v(f, 0)}, scale=${v(f, 1)})`,
  lognormal: (f) => `lognorm(s=${v(f, 1)}, scale=np.exp(${v(f, 0)}))`,
  exponential: (f) => `expon(scale=1/${v(f, 0)})`,
  gamma: (f) => `gamma(a=${v(f, 0)}, scale=${v(f, 1)})`,
  weibull: (f) => `weibull_min(c=${v(f, 0)}, scale=${v(f, 1)})`,
  beta: (f) => `beta(a=${v(f, 0)}, b=${v(f, 1)})`,
  uniform: (f) => `uniform(loc=${v(f, 0)}, scale=${Number(f[1]) - Number(f[0])})`,
  logistic: (f) => `logistic(loc=${v(f, 0)}, scale=${v(f, 1)})`,
  cauchy: (f) => `cauchy(loc=${v(f, 0)}, scale=${v(f, 1)})`,
  triangular: (f) => `triang(c=(${v(f, 1)} - ${v(f, 0)}) / (${v(f, 2)} - ${v(f, 0)}), loc=${v(f, 0)}, scale=${Number(f[2]) - Number(f[0])})`,
  poisson: (f) => `poisson(mu=${v(f, 0)})`,
  binomial: (f) => `binom(n=${v(f, 0)}, p=${v(f, 1)})`,
  geometric: (f) => `geom(p=${v(f, 0)}, loc=-1)  # failures before first success`,
  negbinomial: (f) => `nbinom(n=${v(f, 0)}, p=${v(f, 1)})`,
  hypergeometric: (f) => `hypergeom(M=${v(f, 0)}, n=${v(f, 1)}, N=${v(f, 2)})`,
  bernoulli: (f) => `bernoulli(p=${v(f, 0)})`,
  discrete: (f) => `randint(low=${v(f, 0)}, high=${Number(f[1]) + 1})`,
  truncated: (f) => `truncnorm(a=(${v(f, 2)} - ${v(f, 0)}) / ${v(f, 1)}, b=(${v(f, 3)} - ${v(f, 0)}) / ${v(f, 1)}, loc=${v(f, 0)}, scale=${v(f, 1)})`,
  minextreme: (f) => `gumbel_l(loc=${v(f, 0)}, scale=${v(f, 1)})`,
};

export function rCode(kind: Kind, f: Fields, n: number): string {
  const r = R[kind]?.(f);
  if (!r) return '# Not available';
  const lines = r[0].split('\n');
  const call = lines.pop()!;
  return [`n <- ${n}`, 'set.seed(42)', ...lines, `x <- ${call}`, 'hist(x, probability = TRUE)', `# density / mass at x: ${r[1]}`].join('\n');
}

export function pythonCode(kind: Kind, f: Fields, n: number): string {
  if (kind === 'categorical') return `import numpy as np\n\np = [${v(f, 0)}]\nrng = np.random.default_rng(42)\nx = rng.choice(np.arange(1, len(p) + 1), size=${n}, p=p)`;
  if (kind === 'empirical') return `import numpy as np\n\nobs = [${v(f, 0)}]\nrng = np.random.default_rng(42)\nx = rng.choice(obs, size=${n}, replace=True)`;
  if (kind === 'constant') return `import numpy as np\n\nx = np.full(${n}, ${v(f, 0)})`;
  const d = PY[kind]?.(f);
  if (!d) return '# Not available';
  const name = d.split('(')[0];
  return `import numpy as np\nimport matplotlib.pyplot as plt\nfrom scipy.stats import ${name}\n\ndist = ${d}\nx = dist.rvs(size=${n}, random_state=42)\nplt.hist(x, density=True)\nplt.show()`;
}

export function fitRCode(values: number[]): string {
  return `# install.packages("fitdistrplus")\nlibrary(fitdistrplus)\n\nx <- c(${values.slice(0, 200).join(', ')}${values.length > 200 ? ', ...' : ''})\nfits <- list(\n  norm    = fitdist(x, "norm"),\n  lnorm   = fitdist(x, "lnorm"),\n  exp     = fitdist(x, "exp"),\n  gamma   = fitdist(x, "gamma"),\n  weibull = fitdist(x, "weibull"),\n  logis   = fitdist(x, "logis")\n)\ngofstat(fits)          # AIC, BIC, KS statistic\ndenscomp(fits); qqcomp(fits); cdfcomp(fits)`;
}

export function fitPythonCode(values: number[]): string {
  return `import numpy as np\nfrom scipy import stats\n\nx = np.array([${values.slice(0, 200).join(', ')}${values.length > 200 ? ', ...' : ''}])\nfor name in ["norm", "lognorm", "expon", "gamma", "weibull_min", "logistic"]:\n    dist = getattr(stats, name)\n    fixed = {"floc": 0} if name in ("lognorm", "expon", "gamma", "weibull_min") else {}\n    params = dist.fit(x, **fixed)\n    ll = np.sum(dist.logpdf(x, *params))\n    k = len(params) - len(fixed)\n    print(name, params, "logLik", ll, "AIC", 2 * k - 2 * ll)`;
}

export const LETTERS_CODE = {
  r: (n: number) => `# Sample ${n} random letters\nsample(letters, ${n}, replace = TRUE)`,
  py: (n: number) => `import string, random\n\n# Sample ${n} random letters\nrandom.choices(string.ascii_lowercase, k=${n})`,
};
export const COINS_CODE = {
  r: (n: number, p: number) => `EQ <- c('heads', 'tails')\nsample(EQ, ${n}, replace = TRUE, prob = c(${p.toFixed(2)}, ${(1 - p).toFixed(2)}))`,
  py: (n: number, p: number) => `import random\n\nEQ = ['heads', 'tails']\nrandom.choices(EQ, weights=[${p.toFixed(2)}, ${(1 - p).toFixed(2)}], k=${n})`,
};
export const LINEAR_CODE = {
  r: (b0: number, b1: number, s: number, n: number) => `intercept <- ${b0}   # β0\nslope     <- ${b1}   # β1\nerror_sd  <- ${s}   # σ\nn         <- ${n}\n\nx <- runif(n, 10, 20)\ny <- intercept + slope * x            # deterministic part\ny <- y + rnorm(n, 0, error_sd)        # stochastic part\n\nplot(x, y)\nabline(intercept, slope)              # true relationship\nfit <- lm(y ~ x); abline(fit, lty = 2) # OLS estimate\nconfint(fit)`,
  py: (b0: number, b1: number, s: number, n: number) => `import numpy as np\nimport statsmodels.api as sm\n\nintercept, slope, error_sd, n = ${b0}, ${b1}, ${s}, ${n}\nrng = np.random.default_rng(42)\nx = rng.uniform(10, 20, n)\ny = intercept + slope * x + rng.normal(0, error_sd, n)\n\nfit = sm.OLS(y, sm.add_constant(x)).fit()\nprint(fit.params, fit.conf_int())`,
};
