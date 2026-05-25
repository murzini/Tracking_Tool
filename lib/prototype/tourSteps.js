import { routes } from "./routes";

export function buildTourSteps() {
  return [
    { route: routes.landing, label: "Landing page: value prop + entry to shopping" },
    { route: routes.search, label: "Catalog page: browse products and filters" },
    { route: routes.details, label: "Product details: decide to buy" },
    { route: routes.checkout, label: "Checkout: personal information, delivery, payment" },
    { route: routes.thankyou, label: "End of funnel: thank-you page" },
  ];
}
