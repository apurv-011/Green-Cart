/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import axios from 'axios'

const getBackendURL = () => {
    const configuredURL = import.meta.env.VITE_BACKEND_URL?.trim().replace(/^["']|["']$/g, "")

    if (!configuredURL) {
        return `${window.location.protocol}//${window.location.hostname}:3000`
    }

    const normalizedURL = configuredURL.replace(/\/$/, "")

    try {
        const url = new URL(configuredURL)
        const localHosts = ["localhost", "127.0.0.1"]
        const frontendHost = window.location.hostname

        // If someone accidentally deployed with VITE_BACKEND_URL=localhost, fall back to same-host :3000
        // so the app at least points to the co-located backend domain pattern.
        if (localHosts.includes(url.hostname) && !localHosts.includes(frontendHost)) {
            return `${window.location.protocol}//${frontendHost}:3000`
        }

        if (localHosts.includes(url.hostname) && localHosts.includes(frontendHost) && url.hostname !== frontendHost) {
            url.hostname = frontendHost
            return url.toString().replace(/\/$/, "")
        }
    } catch {
        return normalizedURL
    }

    return normalizedURL
}

axios.defaults.withCredentials = true;
axios.defaults.baseURL = getBackendURL();
axios.defaults.timeout = 15000;

const formatAxiosError = (error) => {
    const status = error?.response?.status;
    const message =
        error?.response?.data?.message ||
        error?.message ||
        "Request failed";

    if (!status) {
        const baseURL = axios.defaults.baseURL || "";
        return `Network error. Check API URL/CORS: ${baseURL}`;
    }

    return `${message} (HTTP ${status})`;
};

// Avoid stacking interceptors during HMR/dev reloads.
if (!globalThis.__GREEN_CART_AXIOS_CONFIGURED__) {
    globalThis.__GREEN_CART_AXIOS_CONFIGURED__ = true;
    axios.interceptors.response.use(
        (response) => response,
        (error) => {
            // Keep callers working; just improve visibility.
            console.error("API error:", formatAxiosError(error), error);
            return Promise.reject(error);
        }
    );
}

export const AppContext = createContext()

export const AppContextProvider = ({ children }) => {

    const currency = import.meta.env.VITE_CURRENCY || "$";

    const navigate = useNavigate()
    const [user, setUser] = useState(null)
    const [authLoading, setAuthLoading] = useState(true)
    const [isSeller, setIsSeller] = useState(false)
    const [showUserLogin, setShowUserLogin] = useState(false)
    const [products, setProducts] = useState([])
    const [cartItems, setCartItems] = useState({})
    const [searchQuery, setSearchQuery] = useState("")

    // fetch Seller Status
    const fetchSeller = async () => {
        try {
            const { data } = await axios.get("/api/seller/is-auth")

            if (data.success) {
                setIsSeller(true)
            } else {
                setIsSeller(false)
            }

        } catch (error) {
            console.error(formatAxiosError(error))
            setIsSeller(false)
        }
    }

    // fetch User Auth Status, User data and cart items
    const fetchUser = async () => {
        try {
            const { data } = await axios.get('/api/user/is-auth')
            if (data.success) {
                setUser(data.user)
                setCartItems(data.user.cartItems || {})
            }
        } catch (error) {
            console.error(formatAxiosError(error))
            setUser(null)
        } finally {
            setAuthLoading(false)
        }
    }


    // Fetch All Products
    const fetchProducts = async () => {
        try {
            const { data } = await axios.get('/api/product/list')

            if (data.success) {
                setProducts(data.products)
            } else {
                toast.error(data.message)
            }

        } catch (error) {
            toast.error(formatAxiosError(error))
        }
    }

    // Add Product to Cart
    const addToCart = (itemId) => {
        let cartData = structuredClone(cartItems)

        if (cartData[itemId]) {
            cartData[itemId] += 1;
        } else {
            cartData[itemId] = 1;
        }
        setCartItems(cartData);
        toast.success("Product added to cart")
    }

    // Update cart item quantity
    const updateCartItem = (itemId, quantity) => {
        let cartData = structuredClone(cartItems)
        cartData[itemId] = quantity;
        setCartItems(cartData);
        toast.success("Cart updated")
    }

    // Remove item from cart
    const removeFromCart = (itemId) => {
        let cartData = structuredClone(cartItems)
        if (cartData[itemId]) {
            cartData[itemId] -= 1;
            if (cartData[itemId] === 0) {
                delete cartData[itemId];
            }
        }
        toast.success("Product removed from cart")
        setCartItems(cartData);
    }

    // Get cart items count
    const getCartCount = () => {
        let totalCount = 0;
        for (const item in cartItems) {
            totalCount += cartItems[item];
        }
        return totalCount;
    }

    // Get cart total amount
    const getCartTotal = () => {
        let totalAmount = 0;
        for (const item in cartItems) {
            let itemInfo = products.find((product) => product._id === item)
            if (itemInfo && cartItems[item] > 0) {
                totalAmount += itemInfo.offerPrice * cartItems[item]
            }
        }
        return Math.floor(totalAmount * 100) / 100;
    }


    useEffect(() => {
        fetchUser()
        fetchSeller()
        fetchProducts()
    }, [])

    useEffect(() => {
        const updateCart = async () => {
            try {
                const { data } = await axios.post("/api/cart/update", { cartItems })
                if (!data.success) {
                    toast.error(data.message)
                } else if (JSON.stringify(data.cartItems || {}) !== JSON.stringify(cartItems)) {
                    setCartItems(data.cartItems || {})
                }
            } catch (error) {
                toast.error(formatAxiosError(error))
            }
        }

        if (user) {
            updateCart()
        }
    }, [cartItems, user])


    const value = { navigate, user, setUser, authLoading, isSeller, setIsSeller, showUserLogin, setShowUserLogin, products, setProducts, currency, addToCart, updateCartItem, removeFromCart, cartItems, searchQuery, setSearchQuery, getCartCount, getCartTotal, axios, fetchProducts, setCartItems }
    return (
        <AppContext.Provider value={value}>
            {children}
        </AppContext.Provider>
    )
}

export const useAppContext = () => {
    return useContext(AppContext)
}
