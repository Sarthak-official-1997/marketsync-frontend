import logo from "../assets/logo.png";

export default function AppLogo({ className = "w-8 h-8" }) {
    return (
        <img
            src={logo}
            alt="MarketSync Logo"
            className={`${className} rounded-lg object-cover`}
        />
    );
}