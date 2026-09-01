# The Gaussian Integral

We want to evaluate the classic integral

$$ I = \int_{-\infty}^{\infty} e^{-x^2} \, dx $$

There is no elementary antiderivative for $e^{-x^2}$, but a well-known *trick* gets us the exact value. The integrand is the familiar bell curve, essentially all of whose area sits within $|x| < 2$:

```gum height=600
const gauss = x => exp(-x*x)
return <Plot aspect={2} margin={[0.2, 0.1]} xlim={[-3, 3]} ylim={[0, 1.25]} xticks={range(-3, 4)} yticks={[0, 0.25, 0.5, 0.75, 1, 1.25]} grid grid-stroke-dasharray={4} title="The Gaussian kernel">
  <SymFill fy1={gauss} fy2={0} xlim={[-3, 3]} fill={blue} opacity={0.3} stroke={none} />
  <SymLine fy={gauss} xlim={[-3, 3]} stroke={blue} stroke-width={2} />
</Plot>
```

## Squaring the integral

Write $I^2$ as a product of two copies with independent variables $x$ and $y$:

$$ I^2 = \int_{-\infty}^{\infty} e^{-x^2} \, dx \int_{-\infty}^{\infty} e^{-y^2} \, dy = \iint_{\mathbb{R}^2} e^{-(x^2 + y^2)} \, dx \, dy $$

The exponent $x^2 + y^2$ begs for **polar coordinates**.

## Switching to polar coordinates

Substitute $x = r \cos\theta$ and $y = r \sin\theta$, with area element $dx \, dy = r \, dr \, d\theta$:

$$ I^2 = \int_0^{2\pi} \int_0^{\infty} e^{-r^2} \, r \, dr \, d\theta $$

The extra factor of $r$ is exactly what we need. With $u = r^2$, so that $du = 2r \, dr$:

$$ \int_0^{\infty} e^{-r^2} \, r \, dr = \frac{1}{2} \int_0^{\infty} e^{-u} \, du = \frac{1}{2} $$

The angular integral just contributes a factor of $2\pi$, so $I^2 = 2\pi \cdot \tfrac{1}{2} = \pi$.

## Result

Since the integrand is positive, $I > 0$, and therefore

$$ \int_{-\infty}^{\infty} e^{-x^2} \, dx = \sqrt{\pi} $$

A few immediate consequences:

- Rescaling gives $\int_{-\infty}^{\infty} e^{-a x^2} \, dx = \sqrt{\pi / a}$ for any $a > 0$.
- The normal density $\frac{1}{\sqrt{2\pi}} e^{-x^2/2}$ integrates to $1$.
- Evaluating the Gamma function at a half-integer: $\Gamma\!\left(\tfrac{1}{2}\right) = \sqrt{\pi}$.
