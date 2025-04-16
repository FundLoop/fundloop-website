import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ArrowLeft, Code, Key, Database } from "lucide-react"

export default function APIPage() {
  return (
    <div className="container mx-auto px-4 py-12">
      <div className="flex items-center gap-2 mb-8">
        <Button asChild variant="ghost" size="sm" className="gap-1">
          <Link href="/">
            <ArrowLeft className="h-4 w-4" />
            <span>Back to Home</span>
          </Link>
        </Button>
      </div>

      <div className="max-w-5xl mx-auto">
        <h1 className="text-3xl md:text-4xl font-bold mb-4">API Documentation</h1>
        <p className="text-slate-600 dark:text-slate-300 text-lg mb-8">
          Integrate your applications with the FundLoop ecosystem using our comprehensive API.
        </p>

        <div className="grid md:grid-cols-3 gap-6 mb-12">
          <Card>
            <CardHeader className="text-center">
              <div className="mx-auto bg-emerald-100 dark:bg-emerald-900/30 p-3 rounded-full mb-4 w-12 h-12 flex items-center justify-center">
                <Key className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
              </div>
              <CardTitle>API Keys</CardTitle>
              <CardDescription>Manage your API credentials</CardDescription>
            </CardHeader>
            <CardContent className="text-center">
              <p className="text-slate-600 dark:text-slate-300 mb-4">
                Generate and manage API keys for secure access to FundLoop services.
              </p>
              <Button variant="outline">Manage Keys</Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="text-center">
              <div className="mx-auto bg-emerald-100 dark:bg-emerald-900/30 p-3 rounded-full mb-4 w-12 h-12 flex items-center justify-center">
                <Code className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
              </div>
              <CardTitle>SDKs</CardTitle>
              <CardDescription>Client libraries for developers</CardDescription>
            </CardHeader>
            <CardContent className="text-center">
              <p className="text-slate-600 dark:text-slate-300 mb-4">
                Download our SDKs for easy integration with various programming languages.
              </p>
              <Button variant="outline">View SDKs</Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="text-center">
              <div className="mx-auto bg-emerald-100 dark:bg-emerald-900/30 p-3 rounded-full mb-4 w-12 h-12 flex items-center justify-center">
                <Database className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
              </div>
              <CardTitle>Webhooks</CardTitle>
              <CardDescription>Real-time event notifications</CardDescription>
            </CardHeader>
            <CardContent className="text-center">
              <p className="text-slate-600 dark:text-slate-300 mb-4">
                Configure webhooks to receive real-time notifications about ecosystem events.
              </p>
              <Button variant="outline">Configure Webhooks</Button>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="rest-api" className="w-full mb-12">
          <TabsList className="grid w-full grid-cols-3 mb-8">
            <TabsTrigger value="rest-api">REST API</TabsTrigger>
            <TabsTrigger value="graphql">GraphQL</TabsTrigger>
            <TabsTrigger value="websockets">WebSockets</TabsTrigger>
          </TabsList>

          <TabsContent value="rest-api">
            <Card>
              <CardHeader>
                <CardTitle>REST API Reference</CardTitle>
                <CardDescription>Our RESTful API provides comprehensive access to FundLoop resources</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  <div>
                    <h3 className="text-lg font-medium mb-2">Authentication</h3>
                    <p className="text-slate-600 dark:text-slate-300 mb-2">
                      All API requests require authentication using API keys. Include your API key in the request
                      header:
                    </p>
                    <div className="bg-slate-100 dark:bg-slate-800 p-3 rounded-md font-mono text-sm">
                      Authorization: Bearer YOUR_API_KEY
                    </div>
                  </div>

                  <div>
                    <h3 className="text-lg font-medium mb-2">Base URL</h3>
                    <div className="bg-slate-100 dark:bg-slate-800 p-3 rounded-md font-mono text-sm">
                      https://api.fundloop.org/v1
                    </div>
                  </div>

                  <div>
                    <h3 className="text-lg font-medium mb-2">Endpoints</h3>
                    <div className="space-y-4">
                      <div>
                        <h4 className="font-medium">Projects</h4>
                        <ul className="list-disc list-inside text-slate-600 dark:text-slate-300 space-y-1">
                          <li>GET /projects - List all projects</li>
                          <li>GET /projects/:id - Get project details</li>
                          <li>POST /projects - Create a new project</li>
                          <li>PUT /projects/:id - Update project details</li>
                        </ul>
                      </div>

                      <div>
                        <h4 className="font-medium">Users</h4>
                        <ul className="list-disc list-inside text-slate-600 dark:text-slate-300 space-y-1">
                          <li>GET /users - List all users</li>
                          <li>GET /users/:id - Get user details</li>
                          <li>POST /users - Create a new user</li>
                          <li>PUT /users/:id - Update user details</li>
                        </ul>
                      </div>

                      <div>
                        <h4 className="font-medium">Contributions</h4>
                        <ul className="list-disc list-inside text-slate-600 dark:text-slate-300 space-y-1">
                          <li>GET /contributions - List all contributions</li>
                          <li>GET /contributions/:id - Get contribution details</li>
                          <li>POST /contributions - Record a new contribution</li>
                          <li>GET /contributions/stats - Get contribution statistics</li>
                        </ul>
                      </div>

                      <div>
                        <h4 className="font-medium">Payments</h4>
                        <ul className="list-disc list-inside text-slate-600 dark:text-slate-300 space-y-1">
                          <li>GET /payments - List all payments</li>
                          <li>GET /payments/:id - Get payment details</li>
                          <li>POST /payments - Create a new payment</li>
                          <li>GET /payments/stats - Get payment statistics</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="graphql">
            <Card>
              <CardHeader>
                <CardTitle>GraphQL API</CardTitle>
                <CardDescription>
                  Our GraphQL API provides flexible querying capabilities for FundLoop data
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  <div>
                    <h3 className="text-lg font-medium mb-2">Endpoint</h3>
                    <div className="bg-slate-100 dark:bg-slate-800 p-3 rounded-md font-mono text-sm">
                      https://api.fundloop.org/graphql
                    </div>
                  </div>

                  <div>
                    <h3 className="text-lg font-medium mb-2">Example Query</h3>
                    <div className="bg-slate-100 dark:bg-slate-800 p-3 rounded-md font-mono text-sm">
                      {`query {
  projects {
    id
    name
    description
    users {
      id
      name
    }
    contributions {
      amount
      date
    }
  }
}`}
                    </div>
                  </div>

                  <div>
                    <h3 className="text-lg font-medium mb-2">Schema</h3>
                    <p className="text-slate-600 dark:text-slate-300 mb-2">
                      Our GraphQL schema includes the following main types:
                    </p>
                    <ul className="list-disc list-inside text-slate-600 dark:text-slate-300 space-y-1">
                      <li>Project - Project information</li>
                      <li>User - User profiles</li>
                      <li>Contribution - Project contributions</li>
                      <li>Payment - Citizen salary payments</li>
                      <li>Analytics - Ecosystem analytics</li>
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="websockets">
            <Card>
              <CardHeader>
                <CardTitle>WebSockets API</CardTitle>
                <CardDescription>Real-time communication with the FundLoop ecosystem</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  <div>
                    <h3 className="text-lg font-medium mb-2">Connection</h3>
                    <div className="bg-slate-100 dark:bg-slate-800 p-3 rounded-md font-mono text-sm">
                      wss://api.fundloop.org/ws
                    </div>
                  </div>

                  <div>
                    <h3 className="text-lg font-medium mb-2">Authentication</h3>
                    <p className="text-slate-600 dark:text-slate-300 mb-2">
                      Include your API key as a query parameter when connecting:
                    </p>
                    <div className="bg-slate-100 dark:bg-slate-800 p-3 rounded-md font-mono text-sm">
                      wss://api.fundloop.org/ws?api_key=YOUR_API_KEY
                    </div>
                  </div>

                  <div>
                    <h3 className="text-lg font-medium mb-2">Events</h3>
                    <p className="text-slate-600 dark:text-slate-300 mb-2">
                      Subscribe to real-time events from the FundLoop ecosystem:
                    </p>
                    <ul className="list-disc list-inside text-slate-600 dark:text-slate-300 space-y-1">
                      <li>project.created - New project joined</li>
                      <li>user.created - New user joined</li>
                      <li>contribution.received - New contribution received</li>
                      <li>payment.sent - Citizen salary payment sent</li>
                      <li>analytics.updated - Ecosystem analytics updated</li>
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <div className="text-center">
          <p className="text-slate-600 dark:text-slate-300 mb-4">
            Need help with the API? Check out our developer documentation or contact support.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button asChild variant="outline">
              <Link href="/documentation">Developer Docs</Link>
            </Button>
            <Button asChild>
              <Link href="/support">Contact Support</Link>
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
