'use client'

import { useStore } from '@/lib/store'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { motion } from 'framer-motion'
import { TrendingUp, Users, CheckCircle2, Clock } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
    },
  },
}

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4 } },
}

export default function DashboardPage() {
  const { projects, tasks, tenant } = useStore()

  const completedTasks = tasks.filter((t) => t.status === 'done').length
  const activeTasks = tasks.filter((t) => t.status === 'in_progress').length
  const totalMembers = new Set(projects.flatMap((p) => p.team.map((m) => m.id))).size
  const activeProjects = projects.filter((p) => p.status === 'active').length

  const stats = [
    {
      title: 'Active Projects',
      value: activeProjects,
      description: `of ${projects.length} total`,
      icon: TrendingUp,
      color: 'from-blue-500/20 to-blue-600/20',
      accentColor: 'text-blue-600',
    },
    {
      title: 'Completed Tasks',
      value: completedTasks,
      description: `${Math.round((completedTasks / tasks.length) * 100)}% completion rate`,
      icon: CheckCircle2,
      color: 'from-green-500/20 to-green-600/20',
      accentColor: 'text-green-600',
    },
    {
      title: 'In Progress',
      value: activeTasks,
      description: 'tasks being worked on',
      icon: Clock,
      color: 'from-amber-500/20 to-amber-600/20',
      accentColor: 'text-amber-600',
    },
    {
      title: 'Team Members',
      value: totalMembers,
      description: `across ${activeProjects} projects`,
      icon: Users,
      color: 'from-purple-500/20 to-purple-600/20',
      accentColor: 'text-purple-600',
    },
  ]

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="p-4 md:p-8 space-y-8"
    >
      {/* Header */}
      <motion.div variants={itemVariants}>
        <h1 className="text-4xl font-bold text-foreground mb-2">Welcome back, Alice</h1>
        <p className="text-muted-foreground">Here's what's happening in {tenant.name} today.</p>
      </motion.div>

      {tenant.onTrial && (
        <motion.div variants={itemVariants} className="rounded-lg border border-amber-300/40 bg-amber-50 dark:bg-amber-950/20 p-4 flex items-center justify-between gap-3">
          <div>
            <p className="font-semibold text-amber-800 dark:text-amber-300">Essai gratuit actif</p>
            <p className="text-sm text-amber-700 dark:text-amber-400">
              Fin d'acces: {tenant.paidUntil || '-'}.
            </p>
          </div>
          <Link href="/dashboard/billing">
            <Button size="sm">Gerer les modules</Button>
          </Link>
        </motion.div>
      )}

      {/* KPI Cards */}
      <motion.div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4" variants={containerVariants}>
        {stats.map((stat, index) => {
          const Icon = stat.icon
          return (
            <motion.div key={index} variants={itemVariants}>
              <Card className="relative overflow-hidden hover:shadow-lg transition-shadow border-border/50">
                <div className={`absolute inset-0 bg-gradient-to-br ${stat.color} opacity-50`} />
                <CardHeader className="relative pb-2">
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-sm font-medium text-muted-foreground mb-2">
                        {stat.title}
                      </CardTitle>
                      <div className="text-3xl font-bold text-foreground mb-1">{stat.value}</div>
                      <CardDescription className="text-xs">{stat.description}</CardDescription>
                    </div>
                    <div className={`p-2 rounded-lg bg-card ${stat.accentColor}`}>
                      <Icon className="w-5 h-5" />
                    </div>
                  </div>
                </CardHeader>
              </Card>
            </motion.div>
          )
        })}
      </motion.div>

      {/* Quick Stats */}
      <motion.div variants={itemVariants} className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Projects */}
        <Card className="border-border/50">
          <CardHeader>
            <CardTitle>Recent Projects</CardTitle>
            <CardDescription>Projects updated this week</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {projects.slice(0, 3).map((project) => (
                <div key={project.id} className="flex items-center justify-between p-2 rounded hover:bg-muted/50 transition-colors">
                  <div>
                    <p className="font-medium text-sm text-foreground">{project.name}</p>
                    <div className="w-full bg-muted rounded-full h-2 mt-2">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${project.progress}%` }}
                        transition={{ duration: 1, delay: 0.5 }}
                        className="h-full rounded-full bg-gradient-to-r from-primary to-accent"
                      />
                    </div>
                  </div>
                  <span className="text-sm font-semibold text-primary">{project.progress}%</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Tasks by Status */}
        <Card className="border-border/50">
          <CardHeader>
            <CardTitle>Task Distribution</CardTitle>
            <CardDescription>Across all projects</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {[
                { status: 'Done', count: completedTasks, color: 'bg-green-500' },
                { status: 'In Progress', count: activeTasks, color: 'bg-blue-500' },
                { status: 'To Do', count: tasks.filter((t) => t.status === 'todo').length, color: 'bg-gray-400' },
                { status: 'Backlog', count: tasks.filter((t) => t.status === 'backlog').length, color: 'bg-amber-600' },
              ].map((item) => (
                <div key={item.status} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${item.color}`} />
                    <span className="text-sm text-muted-foreground">{item.status}</span>
                  </div>
                  <span className="font-semibold text-foreground">{item.count}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  )
}
