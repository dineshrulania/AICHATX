import React, { useContext, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { UserContext } from '../context/user.context'
import axios from '../config/axios'

const UserAuth = ({ children }) => {

    const { user, setUser } = useContext(UserContext)
    const [ loading, setLoading ] = useState(true)
    const token = localStorage.getItem('token')
    const navigate = useNavigate()

    useEffect(() => {
        if (!token) {
            navigate('/login')
            return
        }

        if (user) {
            setLoading(false)
            return
        }

        // Token exists but user not in context (e.g. page refresh) — re-hydrate
        axios.get('/users/profile').then((res) => {
            setUser(res.data.user)
            setLoading(false)
        }).catch(() => {
            localStorage.removeItem('token')
            navigate('/login')
        })

    }, [ token ])

    if (loading) {
        return <div>Loading...</div>
    }


    return (
        <>
            {children}</>
    )
}

export default UserAuth