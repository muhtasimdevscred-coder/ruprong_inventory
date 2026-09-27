import Nav from "./Nav";

export default function MainLayout({ children }) {
  return (
    <div>
      <Nav />
      <div className="page">{children}</div>
    </div>
  );
}
