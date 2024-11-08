import type { LoaderFunctionArgs } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { Form, useLoaderData } from "@remix-run/react";
import { Package } from "lucide-react";
import { login } from "../../shopify.server";
import styles from "./styles.module.css";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url);
  if (url.searchParams.get("shop")) {
    throw redirect(`/app?${url.searchParams.toString()}`);
  }
  return json({ showForm: Boolean(login) });
};

export default function LoginPage() {
  const { showForm } = useLoaderData<typeof loader>();

  return (
    <div className={styles.root}>
      <div className={styles.content}>
        <div className={styles.logo}>
          <Package size={28} />
          <span>Shipyard</span>
        </div>

        <h1 className={styles.title}>
          Bridge the Gap Between Your Store and Customers
        </h1>
        <p className={styles.subtitle}>
          Seamlessly connect your store and customers for smarter insights.
        </p>

        {showForm && (
          <Form method="post" action="/auth/login" className={styles.form}>
            <div className={styles.inputGroup}>
              <input
                type="text"
                name="shop"
                placeholder="Enter your shop domain"
                className={styles.input}
                required
              />
              <span className={styles.hint}>e.g: my-shop-domain.myshopify.com</span>
            </div>

            <div className={styles.checkboxGroup}>
              <label className={styles.checkbox}>
                <input 
                  type="checkbox" 
                  name="terms" 
                  required 
                />
                <span className={styles.checkmark}></span>
                <span className={styles.checkboxLabel}>
                  I agree to the <a href="/terms" className={styles.link}>Terms and Conditions</a>
                </span>
              </label>
            </div>

            <button type="submit" className={styles.button}>
              Connect Store
            </button>
          </Form>
        )}
      </div>
    </div>
  );
}