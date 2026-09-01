# The Gaussian Integral

We want to evaluate the classic integral

$$ I = \int_{-\infty}^{\infty} e^{-x^2} \, dx $$

There is no elementary antiderivative for $e^{-x^2}$, but a well-known *trick* gets us the exact value.

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
