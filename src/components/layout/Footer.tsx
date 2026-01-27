import { Link } from "react-router-dom";
import { Phone, Mail, MapPin } from "lucide-react";
import elifeLogo from "@/assets/elife-logo.png";
export function Footer() {
  return <footer className="bg-primary text-primary-foreground">
      <div className="container py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Brand */}
          <div className="md:col-span-1">
            <div className="mb-4">
              <img src={elifeLogo} alt="e-Life Society" className="h-12 w-auto brightness-0 invert" />
            </div>
            <p className="text-sm opacity-80 leading-relaxed">
              Empowering women across Kerala through structured programs, 
              training, and income-generation initiatives.
            </p>
          </div>

          {/* Quick Links */}
          <div>
            <h4 className="font-display font-semibold mb-4">Quick Links</h4>
            <ul className="space-y-2 text-sm opacity-80">
              <li>
                <Link to="/" className="hover:opacity-100 transition-opacity">
                  Home
                </Link>
              </li>
              <li>
                <Link to="/about" className="hover:opacity-100 transition-opacity">
                  About Us
                </Link>
              </li>
              <li>
                <Link to="/divisions" className="hover:opacity-100 transition-opacity">
                  Our Divisions
                </Link>
              </li>
              <li>
                <Link to="/programs" className="hover:opacity-100 transition-opacity">
                  Programs
                </Link>
              </li>
            </ul>
          </div>

          {/* Divisions */}
          <div>
            <h4 className="font-display font-semibold mb-4">Divisions</h4>
            <ul className="space-y-2 text-sm opacity-80">
              <li>Farmelife</li>
              <li>Organelife</li>
              <li>Foodelife</li>
              <li>Entrelife</li>
              <li>Embryo</li>
              <li>Aval</li>
              <li>Pennyekart</li>
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h4 className="font-display font-semibold mb-4">Contact Us</h4>
            <ul className="space-y-3 text-sm opacity-80">
              <li className="flex items-start gap-2">
                <MapPin className="h-4 w-4 mt-0.5 flex-shrink-0" />
                <span>Malappuram, Kerala, India</span>
              </li>
              <li className="flex items-center gap-2">
                <Phone className="h-4 w-4 flex-shrink-0" />
                <span>+91 9497589094</span>
              </li>
              <li className="flex items-center gap-2">
                <Mail className="h-4 w-4 flex-shrink-0" />
                <span>info@elifesociety.org</span>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-12 pt-8 border-t border-primary-foreground/20 text-center text-sm opacity-60">
          <p>© {new Date().getFullYear()} e-Life Society. All rights reserved.</p>
          <p className="mt-1">സ്ത്രീ ശാക്തീകരണത്തിനായി സമർപ്പിതം | Dedicated to Women Empowerment</p>
        </div>
      </div>
    </footer>;
}