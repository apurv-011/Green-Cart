import React, { useEffect } from 'react'
import { useAppContext } from '../context/AppContext'
import { useLocation } from 'react-router-dom'

const Loading = () => {

    const { navigate, axios, user, authLoading } = useAppContext()
    let { search } = useLocation()
    const query = new URLSearchParams(search)
    const nextURL = query.get('next')
    const sessionId = query.get('session_id')
    const allowedNextURLs = new Set(["my-orders", "cart", "products"])
    const safeNextURL = allowedNextURLs.has(nextURL) ? nextURL : "my-orders"

    useEffect(() => {
        let mounted = true
        let timer

        const scheduleNavigate = (delay) => {
            timer = setTimeout(() => {
                if (mounted) navigate(`/${safeNextURL}`)
            }, delay)
        }

        const run = async () => {
            try {
                if (safeNextURL === "my-orders" && sessionId) {
                    if (authLoading) {
                        scheduleNavigate(5000)
                        return
                    }

                    if (user) {
                    await axios.get("/api/order/stripe/verify", { params: { session_id: sessionId } })
                    }
                }
            } catch {
                // ignore verification errors; user can still see orders once webhook/verification succeeds
            } finally {
                const delay = safeNextURL === "my-orders" && sessionId ? 800 : 5000
                scheduleNavigate(delay)
            }
        }

        run()
        return () => {
            mounted = false
            if (timer) clearTimeout(timer)
        }
    }, [axios, authLoading, navigate, safeNextURL, sessionId, user])
    

    return (
        <div className='flex justify-center items-center h-screen'>
            <div className='animate-spin rounded-full h-16 w-16 border-4 border-gray-300 border-t-primary'>


            </div>
        </div>
    )
}

export default Loading
