'use client';

import Link from 'next/link';
import { motion, type Variants } from 'framer-motion';
import { MarketingHeader } from '@/components/marketing-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  BarChart3,
  CheckCircle2,
  Zap,
  Users,
  Shield,
  TrendingUp,
  GitBranch,
  Database,
} from 'lucide-react';

const features = [
  {
    icon: BarChart3,
    title: 'Project Management',
    description: 'Organize tasks across Kanban, Gantt charts, and timeline views.',
  },
  {
    icon: Zap,
    title: 'Real-time Collaboration',
    description: 'Work together seamlessly with instant updates and notifications.',
  },
  {
    icon: Users,
    title: 'Team Management',
    description: 'Manage team members, roles, and permissions with ease.',
  },
  {
    icon: Shield,
    title: 'Enterprise Security',
    description: 'Bank-grade encryption and compliance with industry standards.',
  },
  {
    icon: TrendingUp,
    title: 'Analytics & Reports',
    description: 'Gain insights with powerful reporting and data visualization.',
  },
  {
    icon: GitBranch,
    title: 'Workflow Automation',
    description: 'Automate repetitive tasks and streamline your processes.',
  },
];

const pricingPlans = [
  {
    name: 'Starter',
    price: '$49',
    description: 'Perfect for small teams',
    features: ['Up to 5 projects', 'Basic reporting', 'Email support', 'Core features'],
  },
  {
    name: 'Professional',
    price: '$149',
    description: 'For growing businesses',
    featured: true,
    features: [
      'Unlimited projects',
      'Advanced analytics',
      'Priority support',
      'Custom workflows',
      'Team collaboration',
      'API access',
    ],
  },
  {
    name: 'Enterprise',
    price: 'Custom',
    description: 'For large organizations',
    features: [
      'Everything in Pro',
      'Advanced security',
      'Dedicated support',
      'Custom integrations',
      'On-premise option',
      'SLA guarantee',
    ],
  },
];

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.2,
    },
  },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.8, ease: 'easeOut' },
  },
};

export default function HomePage() {
  return (
    <div className="min-h-screen bg-background">
      <MarketingHeader />

      {/* Hero Section */}
      <section className="relative py-20 md:py-32 px-4 sm:px-6 lg:px-8 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-primary/5 to-transparent pointer-events-none" />
        <div className="max-w-7xl mx-auto relative">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="text-center space-y-6 md:space-y-8"
          >
            <h1 className="text-4xl md:text-6xl font-bold text-foreground leading-tight">
              Manage Everything{' '}
              <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                Beautifully
              </span>
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground max-w-3xl mx-auto">
              The modern ERP platform designed for teams that move fast. Streamline projects,
              collaborate seamlessly, and deliver results.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
              <Link href="/signup/company">
                <Button size="lg" className="w-full sm:w-auto bg-primary text-primary-foreground">
                  Start Free Trial
                </Button>
              </Link>
              <Button size="lg" variant="outline" className="w-full sm:w-auto">
                Watch Demo
              </Button>
            </div>
          </motion.div>

          {/* Hero Image */}
          <motion.div
            initial={{ opacity: 0, y: 40, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 1, delay: 0.2 }}
            className="mt-16 md:mt-24 rounded-2xl border border-border/50 overflow-hidden bg-card shadow-lg"
          >
            <div className="aspect-video bg-gradient-to-b from-muted/50 to-muted/20 flex items-center justify-center">
              <div className="text-center">
                <Database className="w-16 h-16 mx-auto text-muted-foreground/30 mb-4" />
                <p className="text-muted-foreground">Dashboard Preview</p>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 md:py-32 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
            className="text-center mb-16 md:mb-20"
          >
            <h2 className="text-3xl md:text-5xl font-bold text-foreground mb-4">
              Powerful Features
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Everything you need to manage projects, teams, and workflows in one intuitive platform.
            </p>
          </motion.div>

          <motion.div
            variants={containerVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8"
          >
            {features.map((feature, index) => {
              const Icon = feature.icon;
              return (
                <motion.div key={index} variants={itemVariants}>
                  <Card className="h-full border-border/50 hover:shadow-lg transition-shadow">
                    <CardHeader>
                      <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                        <Icon className="w-6 h-6 text-primary" />
                      </div>
                      <CardTitle className="text-xl">{feature.title}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-muted-foreground">{feature.description}</p>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </motion.div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-20 md:py-32 px-4 sm:px-6 lg:px-8 bg-muted/30">
        <div className="max-w-7xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
            className="text-center mb-16 md:mb-20"
          >
            <h2 className="text-3xl md:text-5xl font-bold text-foreground mb-4">
              Simple, Transparent Pricing
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Choose the plan that works best for your team.
            </p>
          </motion.div>

          <motion.div
            variants={containerVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            className="grid grid-cols-1 md:grid-cols-3 gap-8"
          >
            {pricingPlans.map((plan, index) => (
              <motion.div key={index} variants={itemVariants}>
                <Card
                  className={cn(
                    'h-full border-border/50 flex flex-col',
                    plan.featured && 'border-primary/50 shadow-lg ring-1 ring-primary/20'
                  )}
                >
                  {plan.featured && (
                    <div className="bg-primary text-primary-foreground text-sm font-semibold px-4 py-2 text-center">
                      Most Popular
                    </div>
                  )}
                  <CardHeader>
                    <CardTitle className="text-2xl">{plan.name}</CardTitle>
                    <p className="text-muted-foreground text-sm">{plan.description}</p>
                    <div className="mt-4">
                      <span className="text-4xl font-bold text-foreground">{plan.price}</span>
                      {plan.price !== 'Custom' && (
                        <span className="text-muted-foreground ml-2">/month</span>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="flex-1 flex flex-col">
                    <ul className="space-y-3 mb-6 flex-1">
                      {plan.features.map((feature, i) => (
                        <li key={i} className="flex items-center gap-2 text-sm">
                          <CheckCircle2 className="w-4 h-4 text-accent flex-shrink-0" />
                          {feature}
                        </li>
                      ))}
                    </ul>
                    <Button
                      className="w-full"
                      variant={plan.featured ? 'default' : 'outline'}
                    >
                      Get Started
                    </Button>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 md:py-32 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
            className="bg-gradient-to-r from-primary/10 to-accent/10 border border-primary/20 rounded-2xl p-8 md:p-12 text-center"
          >
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
              Ready to Transform Your Workflow?
            </h2>
            <p className="text-lg text-muted-foreground mb-8">
              Join thousands of teams already using CorpCore to streamline their operations.
            </p>
            <Link href="/signup/company">
              <Button size="lg" className="bg-primary text-primary-foreground">
                Start Your Free Trial Today
              </Button>
            </Link>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/50 py-12 px-4 sm:px-6 lg:px-8 bg-muted/30">
        <div className="max-w-7xl mx-auto text-center text-sm text-muted-foreground">
          <p>&copy; 2024 CorpCore ERP. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}

function cn(...classes: any[]) {
  return classes.filter(Boolean).join(' ');
}
