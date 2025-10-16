'use client';

import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';

import Home from '@/app/pages/Home';
import Login from '@/app/pages/Login';
import Register from '@/app/pages/Register';
import Admin from '@/app/pages/Admin';
import Attendance from '@/app/pages/Attendance';
import Transactions from '@/app/pages/Transactions';
import AccessRequestPage from '@/app/pages/AccessRequestPage';
import Users from '@/app/pages/admin/Users';
import SalesCalendar from '@/app/pages/admin/SalesCalendar';
import AttendanceCalendar from '@/app/pages/admin/AttendanceCalendar';

export default function SpaShell() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/admin" element={<Admin />} />
        <Route path="/attendance" element={<Attendance />} />
        <Route path="/transactions" element={<Transactions />} />
        <Route path="/access-request" element={<AccessRequestPage />} />
        <Route path="/admin/users" element={<Users />} />
        <Route path="/admin/sales-calendar" element={<SalesCalendar />} />
        <Route path="/admin/attendance-calendar" element={<AttendanceCalendar />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
