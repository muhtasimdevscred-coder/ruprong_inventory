import "./globals.css";

export const metadata = {
  title: "RupRong Inventory & Invoicing",
  description: "Inventory and invoicing for RupRong by Ananna",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
