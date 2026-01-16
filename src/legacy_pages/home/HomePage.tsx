import { useState } from 'react'
import { motion } from 'framer-motion'
import { Toaster, toast } from 'sonner'
import {
  Calendar,
  BarChart3,
  Shield,
  TrendingUp,
  CheckCircle2,
  CreditCard,
  PieChart,
  FileText,
  Phone,
  MessageSquare,
  Star,
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { GlassCard } from '../../components/ui/GlassCard'
import { GlassInput } from '../../components/ui/GlassInput'
import { GlassButton } from '../../components/ui/GlassButton'
import { SEO } from '../../components/common/SEO'

export const HomePage = () => {
  const [hoveredTab, setHoveredTab] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSubmitted, setIsSubmitted] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    practiceName: '',
    message: '',
  })

  const handleContactSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!formData.name || !formData.email || !formData.phone || !formData.practiceName || !formData.message) {
      toast.error('Please fill in all fields')
      return
    }

    setIsSubmitting(true)

    try {
      const { data, error } = await supabase.functions.invoke('contact-sales', {
        body: {
          name: formData.name,
          email: formData.email,
          phone: formData.phone,
          practiceName: formData.practiceName,
          message: formData.message,
        },
      })

      if (error) {
        console.error('[HomePage] Error submitting contact form:', error)
        toast.error(error.message || 'Failed to submit form. Please try again.')
        return
      }

      if (data?.error) {
        toast.error(data.error)
        return
      }

      setIsSubmitted(true)
      setFormData({ name: '', email: '', phone: '', practiceName: '', message: '' })
      toast.success('Thank you! We will be in touch shortly to set up your account.')
    } catch (error) {
      console.error('[HomePage] Error:', error)
      toast.error('Failed to submit form. Please try again or contact us directly.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const scrollToSection = (id: string) => {
    const element = document.getElementById(id)
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }

  const features = [
    {
      icon: Calendar,
      title: 'Automated Scheduling',
      description: 'Intelligent appointment booking system that automatically manages your calendar and prevents double-bookings.',
    },
    {
      icon: FileText,
      title: 'Patient Records',
      description: 'Comprehensive digital patient records management with secure, encrypted storage and easy access.',
    },
    {
      icon: BarChart3,
      title: 'Analytics Dashboard',
      description: 'Real-time insights into your practice performance with customizable reports and visualizations.',
    },
    {
      icon: Shield,
      title: 'Insurance Processing',
      description: 'Streamlined insurance claim processing with automated verification and submission workflows.',
    },
    {
      icon: Phone,
      title: 'Teledentistry',
      description: 'Integrated video consultation platform for remote patient care and follow-ups.',
    },
    {
      icon: MessageSquare,
      title: 'SMS Reminders',
      description: 'Automated appointment reminders via SMS to reduce no-shows and improve patient engagement.',
    },
  ]

  const reviews = [
    {
      rating: 5,
      quote: 'This platform has completely changed how we run our clinic. The scheduling system alone saves us hours every week.',
      name: 'Dr. Sarah Johnson',
      clinic: 'Bright Smiles Dental',
      avatar: 'SJ',
    },
    {
      rating: 5,
      quote: 'The analytics dashboard gives us insights we never had before. We can now make data-driven decisions about our practice.',
      name: 'Dr. Michael Chen',
      clinic: 'Coastal Dental Care',
      avatar: 'MC',
    },
    {
      rating: 5,
      quote: 'Patient records management is seamless, and our patients love the easy booking process. Highly recommended!',
      name: 'Dr. Emily Rodriguez',
      clinic: 'Mountain View Dentistry',
      avatar: 'ER',
    },
  ]

  return (
    <div className="min-h-screen bg-slate-50">
      <SEO
        title="Dentist Planner - Modern Practice Management"
        description="The all-in-one solution for dental bookings, reminders, and practice management. Streamline your dental practice with automated scheduling, patient records, and analytics."
        keywords="dental practice management, appointment booking software, dentist scheduling, practice management system, dental software"
      />
      <Toaster position="top-right" richColors />
      {/* Floating Pill Navigation Header */}
      <header className="fixed top-6 left-1/2 -translate-x-1/2 z-50 w-[90%] max-w-4xl">
        <nav className="bg-white/80 backdrop-blur-md border border-white/20 rounded-full shadow-lg shadow-slate-200/50 px-4 py-2">
          <div className="flex items-center justify-between">
            {/* Left: Brand Logo */}
            <div className="flex items-center gap-1.5">
              <img 
                src="/dentallink-logo.png" 
                alt="DentalLink Icon" 
                className="h-6 w-auto rounded-lg"
                style={{ imageRendering: 'auto', filter: 'contrast(1.05)' }}
              />
              <img 
                src="/logo.png" 
                alt="DentalLink Logo" 
                className="h-6 w-auto"
              />
            </div>

            {/* Center: Navigation Links */}
            <div
              className="hidden md:flex items-center gap-2 cursor-none group"
              onMouseLeave={() => setHoveredTab(null)}
            >
              {[
                { label: 'Home', id: 'hero' },
                { label: 'Features', id: 'features' },
                { label: 'Contact', id: 'contact' },
                { label: 'Reviews', id: 'reviews' },
              ].map((item) => (
                <button
                  key={item.id}
                  onClick={() => scrollToSection(item.id)}
                  onMouseEnter={() => setHoveredTab(item.id)}
                  className={`relative px-3 py-1 text-xs font-medium transition-colors cursor-none z-10 ${
                    hoveredTab === item.id ? 'text-white' : 'text-slate-600'
                  }`}
                >
                  {hoveredTab === item.id && (
                    <motion.div
                      layoutId="nav-pill"
                      className="absolute inset-0 bg-slate-900 rounded-full z-0"
                      transition={{
                        type: 'spring',
                        bounce: 0.2,
                        duration: 0.6,
                      }}
                    />
                  )}
                  <span className="relative z-10">{item.label}</span>
                </button>
              ))}
            </div>

            {/* Right: CTA */}
            <button
              onClick={() => scrollToSection('contact')}
              className="bg-slate-900 text-white text-xs font-medium px-4 py-1.5 rounded-full hover:bg-slate-800 hover:shadow-lg transition-all"
            >
              Contact Us
            </button>
          </div>
        </nav>
      </header>

      {/* Section 1: Floating UI Hero */}
      <section id="hero" className="relative min-h-[600px] flex items-center justify-center overflow-hidden bg-slate-50 px-4 sm:px-6 lg:px-8">
        {/* Background Blobs */}
        <div className="absolute top-0 left-0 w-96 h-96 bg-indigo-100/50 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2"></div>
        <div className="absolute bottom-0 right-0 w-96 h-96 bg-indigo-100/50 rounded-full blur-3xl translate-x-1/2 translate-y-1/2"></div>
        {/* Floating Card 1 - Revenue Stat (Top-Left) */}
        <motion.div
          className="absolute top-10 left-[10%] bg-white border border-slate-200 rounded-xl p-4 shadow-lg -rotate-6 z-10"
          animate={{
            y: [0, -10, 0],
          }}
          transition={{
            duration: 3,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        >
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-emerald-500 rounded-full"></div>
            <span className="text-sm font-semibold text-slate-900">Revenue</span>
          </div>
          <div className="flex items-center gap-1 mt-1">
            <span className="text-lg font-bold text-slate-900">$7,840</span>
            <TrendingUp className="h-4 w-4 text-emerald-500" />
          </div>
        </motion.div>

        {/* Floating Card 2 - Payment Card (Top-Right) */}
        <motion.div
          className="absolute top-20 right-[15%] bg-white border border-slate-200 rounded-xl p-4 shadow-lg rotate-12 z-10"
          animate={{
            y: [0, -8, 0],
          }}
          transition={{
            duration: 3.5,
            repeat: Infinity,
            ease: 'easeInOut',
            delay: 0.3,
          }}
        >
          <div className="flex items-center gap-2">
            <CreditCard className="h-4 w-4 text-indigo-600" />
            <span className="text-sm font-semibold text-slate-900">Payment</span>
          </div>
          <div className="mt-2 text-xs text-slate-500">**** 4532</div>
        </motion.div>

        {/* Floating Card 3 - Stats Card (Bottom-Right) */}
        <motion.div
          className="absolute bottom-10 right-[10%] bg-white border border-slate-200 rounded-xl p-3 shadow-lg -rotate-3 z-10"
          animate={{
            y: [0, 10, 0],
          }}
          transition={{
            duration: 2.5,
            repeat: Infinity,
            ease: 'easeInOut',
            delay: 0.7,
          }}
        >
          <PieChart className="h-6 w-6 text-indigo-600" />
        </motion.div>

        {/* Floating Card 4 - Security Badge (Bottom-Left) */}
        <motion.div
          className="absolute bottom-20 left-[8%] bg-white border border-slate-200 rounded-full px-4 py-2 shadow-lg rotate-5 z-10"
          animate={{
            y: [0, 8, 0],
          }}
          transition={{
            duration: 3,
            repeat: Infinity,
            ease: 'easeInOut',
            delay: 1,
          }}
        >
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-indigo-600" />
            <span className="text-sm font-medium text-slate-900">Secure</span>
          </div>
        </motion.div>

        {/* Floating Card 5 - Trusted Users (Center-Right) */}
        <motion.div
          className="absolute right-[5%] top-1/2 -translate-y-1/2 bg-white border border-slate-200 rounded-xl p-4 shadow-lg z-10"
          animate={{
            y: [0, -6, 0],
          }}
          transition={{
            duration: 2.8,
            repeat: Infinity,
            ease: 'easeInOut',
            delay: 0.5,
          }}
        >
          <div className="flex items-center gap-2">
            <div className="flex -space-x-2">
              <div className="w-8 h-8 bg-slate-900 rounded-full border-2 border-white flex items-center justify-center">
                <span className="text-white text-xs font-bold">A</span>
              </div>
              <div className="w-8 h-8 bg-indigo-600 rounded-full border-2 border-white flex items-center justify-center">
                <span className="text-white text-xs font-bold">B</span>
              </div>
              <div className="w-8 h-8 bg-slate-400 rounded-full border-2 border-white flex items-center justify-center">
                <span className="text-white text-xs font-bold">C</span>
              </div>
            </div>
            <div className="ml-2">
              <div className="text-xs font-semibold text-slate-900">500+</div>
              <div className="text-xs text-slate-500">Trusted Users</div>
            </div>
          </div>
        </motion.div>

        {/* Centered Content */}
        <div className="text-center max-w-4xl mx-auto relative z-20 translate-y-8">
          <h1 className="text-5xl sm:text-6xl md:text-7xl font-bold text-slate-900 mb-6">
            Unlock the future of Dental Practice Management
          </h1>
          <p className="text-xl text-slate-500 max-w-2xl mx-auto mb-8">
            Streamline scheduling, manage services, and grow your practice with powerful analytics
            designed for modern dental practices.
          </p>
          <button
            onClick={() => scrollToSection('contact')}
            className="inline-flex items-center justify-center px-8 py-4 bg-slate-900 text-white rounded-full font-medium hover:bg-slate-800 transition-colors text-lg"
          >
            Request Access
          </button>
        </div>
      </section>

      {/* Section 2: Features Grid */}
      <section id="features" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-4">
            Everything you need to run your practice
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((feature, index) => {
            const Icon = feature.icon
            return (
              <motion.div
                key={index}
                className="bg-white border border-slate-100 rounded-2xl p-6 shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all cursor-pointer"
                whileHover={{ scale: 1.02 }}
              >
                <div className="w-12 h-12 bg-slate-50 rounded-lg flex items-center justify-center mb-4">
                  <Icon className="h-6 w-6 text-slate-900" />
                </div>
                <h3 className="text-lg font-bold text-slate-900 mb-2">{feature.title}</h3>
                <p className="text-sm text-slate-500">{feature.description}</p>
              </motion.div>
            )
          })}
        </div>
      </section>

      {/* Section 3: Solutions Split Sections */}
      <section id="solutions" className="bg-white border-t border-slate-200">
        {/* Row 1: Text Left / Mock UI Right */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-4">
                Manage finance with precision
              </h2>
              <p className="text-lg text-slate-500 mb-6">
                Track your practice's financial performance with comprehensive analytics. Monitor revenue
                trends, appointment patterns, and service profitability all in one place.
              </p>
              <ul className="space-y-3">
                <li className="flex items-center gap-3">
                  <CheckCircle2 className="h-5 w-5 text-indigo-600" />
                  <span className="text-slate-600">Real-time revenue tracking</span>
                </li>
                <li className="flex items-center gap-3">
                  <CheckCircle2 className="h-5 w-5 text-indigo-600" />
                  <span className="text-slate-600">Service performance analytics</span>
                </li>
                <li className="flex items-center gap-3">
                  <CheckCircle2 className="h-5 w-5 text-indigo-600" />
                  <span className="text-slate-600">Customizable reports</span>
                </li>
              </ul>
            </div>
            <div className="bg-white rounded-xl border border-slate-200 shadow-2xl p-6">
              <div className="mb-4">
                <h3 className="text-sm font-semibold text-slate-900 mb-2">Revenue Overview</h3>
                <div className="flex items-end gap-2 h-48">
                  <div className="flex-1 flex flex-col items-center justify-end">
                    <div className="w-full bg-indigo-600 rounded-t" style={{ height: '60%' }}></div>
                    <span className="text-xs text-slate-500 mt-2">Mon</span>
                  </div>
                  <div className="flex-1 flex flex-col items-center justify-end">
                    <div className="w-full bg-indigo-600 rounded-t" style={{ height: '80%' }}></div>
                    <span className="text-xs text-slate-500 mt-2">Tue</span>
                  </div>
                  <div className="flex-1 flex flex-col items-center justify-end">
                    <div className="w-full bg-indigo-600 rounded-t" style={{ height: '45%' }}></div>
                    <span className="text-xs text-slate-500 mt-2">Wed</span>
                  </div>
                  <div className="flex-1 flex flex-col items-center justify-end">
                    <div className="w-full bg-indigo-600 rounded-t" style={{ height: '90%' }}></div>
                    <span className="text-xs text-slate-500 mt-2">Thu</span>
                  </div>
                  <div className="flex-1 flex flex-col items-center justify-end">
                    <div className="w-full bg-indigo-600 rounded-t" style={{ height: '70%' }}></div>
                    <span className="text-xs text-slate-500 mt-2">Fri</span>
                  </div>
                  <div className="flex-1 flex flex-col items-center justify-end">
                    <div className="w-full bg-indigo-600 rounded-t" style={{ height: '50%' }}></div>
                    <span className="text-xs text-slate-500 mt-2">Sat</span>
                  </div>
                  <div className="flex-1 flex flex-col items-center justify-end">
                    <div className="w-full bg-indigo-600 rounded-t" style={{ height: '30%' }}></div>
                    <span className="text-xs text-slate-500 mt-2">Sun</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Row 2: Mock UI Left / Text Right */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24 border-t border-slate-200">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div className="bg-white rounded-xl border border-slate-200 shadow-2xl p-6 order-2 lg:order-1">
              <div className="mb-4">
                <h3 className="text-sm font-semibold text-slate-900 mb-4">Patient List</h3>
                <div className="space-y-3">
                  {/* Skeleton Rows */}
                  <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
                    <div className="w-10 h-10 bg-slate-200 rounded-full"></div>
                    <div className="flex-1">
                      <div className="h-4 bg-slate-200 rounded w-3/4 mb-2"></div>
                      <div className="h-3 bg-slate-200 rounded w-1/2"></div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
                    <div className="w-10 h-10 bg-slate-200 rounded-full"></div>
                    <div className="flex-1">
                      <div className="h-4 bg-slate-200 rounded w-2/3 mb-2"></div>
                      <div className="h-3 bg-slate-200 rounded w-1/2"></div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
                    <div className="w-10 h-10 bg-slate-200 rounded-full"></div>
                    <div className="flex-1">
                      <div className="h-4 bg-slate-200 rounded w-4/5 mb-2"></div>
                      <div className="h-3 bg-slate-200 rounded w-1/2"></div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
                    <div className="w-10 h-10 bg-slate-200 rounded-full"></div>
                    <div className="flex-1">
                      <div className="h-4 bg-slate-200 rounded w-3/5 mb-2"></div>
                      <div className="h-3 bg-slate-200 rounded w-1/2"></div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="order-1 lg:order-2">
              <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-4">
                Get into production with engineering support
              </h2>
              <p className="text-lg text-slate-500 mb-6">
                Built on enterprise-grade infrastructure with 99.9% uptime guarantee. Our platform
                scales with your practice and provides reliable, secure access to your data.
              </p>
              <ul className="space-y-3">
                <li className="flex items-center gap-3">
                  <CheckCircle2 className="h-5 w-5 text-indigo-600" />
                  <span className="text-slate-600">99.9% uptime SLA</span>
                </li>
                <li className="flex items-center gap-3">
                  <CheckCircle2 className="h-5 w-5 text-indigo-600" />
                  <span className="text-slate-600">Automated backups</span>
                </li>
                <li className="flex items-center gap-3">
                  <CheckCircle2 className="h-5 w-5 text-indigo-600" />
                  <span className="text-slate-600">24/7 monitoring</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Section 4: Reviews */}
      <section id="reviews" className="bg-slate-50 border-t border-slate-200 py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-4">
              What our customers say
            </h2>
            <p className="text-lg text-slate-500">Trusted by dental practices nationwide</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {reviews.map((review, index) => (
              <div
                key={index}
                className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm hover:shadow-lg transition-shadow"
              >
                {/* Star Rating */}
                <div className="flex items-center gap-1 mb-4">
                  {Array.from({ length: review.rating }).map((_, i) => (
                    <Star key={i} className="h-5 w-5 fill-yellow-400 text-yellow-400" />
                  ))}
                </div>

                {/* Quote */}
                <p className="text-slate-600 mb-6 italic">"{review.quote}"</p>

                {/* User Profile */}
                <div className="flex items-center gap-3 pt-4 border-t border-slate-100">
                  <div className="w-10 h-10 bg-slate-900 rounded-full flex items-center justify-center">
                    <span className="text-white text-sm font-semibold">{review.avatar}</span>
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-slate-900">{review.name}</div>
                    <div className="text-xs text-slate-500">{review.clinic}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Section 5: Contact Form */}
      <section id="contact" className="bg-white border-t border-slate-200 py-12 pt-24">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-8">
            <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 mb-3">
              Request Access
            </h2>
            <p className="text-base text-slate-500">
              Fill out the form below and we'll get in touch to set up your practice account.
            </p>
          </div>

          {isSubmitted ? (
            <GlassCard className="p-6 text-center">
              <div className="mb-4 flex justify-center">
                <div className="rounded-full bg-emerald-100 p-3">
                  <CheckCircle2 className="h-10 w-10 text-emerald-600" />
                </div>
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-3">
                Thank You!
              </h3>
              <p className="text-slate-600 mb-4 text-sm">
                We will be in touch shortly to set up your account.
              </p>
              <GlassButton
                variant="secondary"
                onClick={() => setIsSubmitted(false)}
              >
                Submit Another Request
              </GlassButton>
            </GlassCard>
          ) : (
            <GlassCard className="p-6">
              <form onSubmit={handleContactSubmit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <GlassInput
                    label="Full Name"
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="John Doe"
                    required
                  />
                  <GlassInput
                    label="Work Email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="john@dentalpractice.com"
                    required
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <GlassInput
                    label="Phone Number"
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="+1 (555) 123-4567"
                    required
                  />
                  <GlassInput
                    label="Practice Name"
                    type="text"
                    value={formData.practiceName}
                    onChange={(e) => setFormData({ ...formData, practiceName: e.target.value })}
                    placeholder="Bright Smiles Dental"
                    required
                  />
                </div>

                <div>
                  <label className="flex flex-col gap-2 text-sm font-medium text-slate-700">
                    <span>Tell us about your needs</span>
                    <textarea
                      value={formData.message}
                      onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                      rows={4}
                      className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-200 resize-none"
                      placeholder="Tell us about your practice, number of locations, current appointment system, and any specific requirements..."
                      required
                    />
                  </label>
                </div>

                <GlassButton
                  type="submit"
                  isLoading={isSubmitting}
                  className="w-full"
                  size="md"
                >
                  {isSubmitting ? 'Submitting...' : 'Submit Request'}
                </GlassButton>
              </form>
            </GlassCard>
          )}
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-slate-900 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="text-center">
            <p className="text-slate-400">
              © {new Date().getFullYear()} Dental Practice Management System. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  )
}
